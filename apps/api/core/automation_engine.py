from sqlalchemy import create_engine
from sqlalchemy.sql import text
from core.config import settings
from datetime import datetime, timezone
import json
import httpx
import re
import logging

logger = logging.getLogger(__name__)


class TemplateResolver:
    @staticmethod
    def extract_variables(template_body: str) -> list[str]:
        pattern = r'\{([^}]+)\}'
        matches = re.findall(pattern, template_body)
        return list(set(matches))

    @staticmethod
    def resolve(template_body: str, context: dict) -> str:
        def replace_match(match):
            path = match.group(1)
            value = resolve_path(path, context)
            if value is None:
                return match.group(0)
            return str(value)

        pattern = r'\{([^}]+)\}'
        return re.sub(pattern, replace_match, template_body)


def resolve_path(path: str, context: dict) -> any:
    keys = path.split('.')
    value = context
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
        elif isinstance(value, list) and key.isdigit():
            idx = int(key)
            value = value[idx] if idx < len(value) else None
        else:
            return None
        if value is None:
            return None
    return value


class AutomationEngine:
    def __init__(self):
        self.engine = create_engine(settings.database_url)
        self.operators = {
            'equals': lambda a, b: a == b,
            'in': lambda a, b: a in b if isinstance(b, list) else False,
            '>=': lambda a, b: float(a) >= float(b) if self._can_compare(a, b) else False,
            '<=': lambda a, b: float(a) <= float(b) if self._can_compare(a, b) else False,
            'contains_any': lambda a, b: any(item in str(a) for item in b) if isinstance(b, list) else False,
            'between': lambda a, b: self._check_between(a, b),
        }

    def _can_compare(self, a: any, b: any) -> bool:
        try:
            float(a)
            float(b)
            return True
        except (TypeError, ValueError):
            return False

    def _check_between(self, value: any, range_list: list) -> bool:
        if not isinstance(range_list, list) or len(range_list) != 2:
            return False
        try:
            val = float(value)
            return float(range_list[0]) <= val <= float(range_list[1])
        except (TypeError, ValueError):
            return False

    def evaluate_condition(self, condition: dict, context: dict) -> bool:
        field = condition.get('field')
        operator = condition.get('operator')
        value = condition.get('value')

        if not field or not operator:
            logger.warning(f"Invalid condition: missing field or operator - {condition}")
            return False

        try:
            field_value = resolve_path(field, context)
        except Exception as e:
            logger.warning(f"Failed to resolve field path '{field}': {e}")
            return False

        if field_value is None:
            logger.debug(f"Field '{field}' resolved to None in context")
            return False

        op_func = self.operators.get(operator)
        if not op_func:
            logger.warning(f"Unknown operator: {operator}")
            return False

        try:
            return op_func(field_value, value)
        except Exception as e:
            logger.error(f"Error evaluating condition {condition}: {e}")
            return False

    def evaluate_conditions(self, conditions: dict, context: dict) -> bool:
        all_conditions = conditions.get('all', [])
        any_conditions = conditions.get('any', [])

        if all_conditions:
            for cond in all_conditions:
                if not self.evaluate_condition(cond, context):
                    return False
            return True

        if any_conditions:
            for cond in any_conditions:
                if self.evaluate_condition(cond, context):
                    return True
            return False

        logger.warning("No conditions to evaluate")
        return True

    def resolve_template(self, template: str, context: dict) -> str:
        return TemplateResolver.resolve(template, context)

    def execute_action(self, action: dict, context: dict) -> dict:
        action_type = action.get('type')
        action_config = action.get('config', {})

        if not action_type:
            return {'success': False, 'error': 'Missing action type'}

        try:
            if action_type == 'send_whatsapp':
                return self._send_whatsapp(action_config, context)
            elif action_type == 'update_event_status':
                return self._update_event_status(action_config, context)
            elif action_type == 'create_reminder':
                return self._create_reminder(action_config, context)
            elif action_type == 'update_entity':
                return self._update_entity(action_config, context)
            elif action_type == 'webhook':
                return self._webhook(action_config, context)
            elif action_type == 'create_task':
                return self._create_task(action_config, context)
            else:
                return {'success': False, 'error': f'Unknown action type: {action_type}'}
        except Exception as e:
            logger.error(f"Error executing action {action_type}: {e}")
            return {'success': False, 'error': str(e)}

    def _send_whatsapp(self, config: dict, context: dict) -> dict:
        from core.baileys_client import baileys_client

        phone = self.resolve_template(str(config.get('phone', '')), context)
        message = self.resolve_template(str(config.get('message', '')), context)

        if not phone or not message:
            return {'success': False, 'error': 'Missing phone or message'}

        try:
            result = baileys_client.send_message(phone, message)
            return {'success': True, 'result': result}
        except Exception as e:
            logger.error(f"Failed to send WhatsApp message: {e}")
            return {'success': False, 'error': str(e)}

    def _update_event_status(self, config: dict, context: dict) -> dict:
        event_id = self.resolve_template(str(config.get('event_id', '')), context)
        new_status = self.resolve_template(str(config.get('status', '')), context)

        if not event_id or not new_status:
            return {'success': False, 'error': 'Missing event_id or status'}

        with self.engine.connect() as conn:
            result = conn.execute(
                text("UPDATE events SET status = :status, updated_at = :updated_at WHERE id = :id"),
                {'status': new_status, 'updated_at': datetime.now(timezone), 'id': event_id}
            )
            conn.commit()
            return {'success': result.rowcount > 0, 'affected_rows': result.rowcount}

    def _create_reminder(self, config: dict, context: dict) -> dict:
        entity_id = self.resolve_template(str(config.get('entity_id', '')), context)
        message = self.resolve_template(str(config.get('message', '')), context)
        reminder_date = self.resolve_template(str(config.get('reminder_date', '')), context)

        if not entity_id or not message:
            return {'success': False, 'error': 'Missing entity_id or message'}

        with self.engine.connect() as conn:
            result = conn.execute(
                text("""
                    INSERT INTO reminders (entity_id, message, reminder_date, created_at, status)
                    VALUES (:entity_id, :message, :reminder_date, :created_at, 'pending')
                """),
                {
                    'entity_id': entity_id,
                    'message': message,
                    'reminder_date': reminder_date,
                    'created_at': datetime.now(timezone)
                }
            )
            conn.commit()
            return {'success': True, 'reminder_id': result.lastrowid}

    def _update_entity(self, config: dict, context: dict) -> dict:
        entity_id = self.resolve_template(str(config.get('entity_id', '')), context)
        entity_type = self.resolve_template(str(config.get('entity_type', '')), context)
        fields = config.get('fields', {})

        if not entity_id or not entity_type:
            return {'success': False, 'error': 'Missing entity_id or entity_type'}

        resolved_fields = {}
        for key, value in fields.items():
            resolved_fields[key] = self.resolve_template(str(value), context)

        set_clause = ', '.join([f"{k} = :{k}" for k in resolved_fields.keys()])
        set_clause += ', updated_at = :updated_at'
        resolved_fields['updated_at'] = datetime.now(timezone)
        resolved_fields['id'] = entity_id

        with self.engine.connect() as conn:
            result = conn.execute(
                text(f"UPDATE {entity_type} SET {set_clause} WHERE id = :id"),
                resolved_fields
            )
            conn.commit()
            return {'success': result.rowcount > 0, 'affected_rows': result.rowcount}

    def _webhook(self, config: dict, context: dict) -> dict:
        url = self.resolve_template(str(config.get('url', '')), context)
        method = config.get('method', 'POST').upper()
        headers = config.get('headers', {})
        body = config.get('body', {})

        if not url:
            return {'success': False, 'error': 'Missing URL'}

        resolved_headers = {}
        for key, value in headers.items():
            resolved_headers[key] = self.resolve_template(str(value), context)

        resolved_body = {}
        for key, value in body.items():
            resolved_body[key] = self.resolve_template(str(value), context)

        try:
            with httpx.Client(timeout=30.0) as client:
                if method == 'GET':
                    response = client.get(url, headers=resolved_headers, params=resolved_body)
                elif method == 'POST':
                    response = client.post(url, headers=resolved_headers, json=resolved_body)
                elif method == 'PUT':
                    response = client.put(url, headers=resolved_headers, json=resolved_body)
                elif method == 'DELETE':
                    response = client.delete(url, headers=resolved_headers)
                else:
                    return {'success': False, 'error': f'Unsupported HTTP method: {method}'}

                return {
                    'success': 200 <= response.status_code < 300,
                    'status_code': response.status_code,
                    'response': response.text[:500]
                }
        except httpx.TimeoutException:
            return {'success': False, 'error': 'Request timeout'}
        except Exception as e:
            logger.error(f"Webhook request failed: {e}")
            return {'success': False, 'error': str(e)}

    def _create_task(self, config: dict, context: dict) -> dict:
        task_type = self.resolve_template(str(config.get('task_type', '')), context)
        title = self.resolve_template(str(config.get('title', '')), context)
        description = self.resolve_template(str(config.get('description', '')), context)
        priority = config.get('priority', 'medium')
        entity_id = self.resolve_template(str(config.get('entity_id', '')), context)

        if not task_type or not title:
            return {'success': False, 'error': 'Missing task_type or title'}

        with self.engine.connect() as conn:
            result = conn.execute(
                text("""
                    INSERT INTO human_review_queue (task_type, title, description, priority, entity_id, status, created_at)
                    VALUES (:task_type, :title, :description, :priority, :entity_id, 'pending', :created_at)
                """),
                {
                    'task_type': task_type,
                    'title': title,
                    'description': description,
                    'priority': priority,
                    'entity_id': entity_id,
                    'created_at': datetime.now(timezone)
                }
            )
            conn.commit()
            return {'success': True, 'task_id': result.lastrowid}

    def resolve_path(self, path: str, context: dict) -> any:
        return resolve_path(path, context)

    def process_trigger(self, trigger_type: str, context: dict) -> dict:
        results = {
            'trigger_type': trigger_type,
            'rules_evaluated': 0,
            'rules_matched': 0,
            'actions_executed': 0,
            'action_results': []
        }

        try:
            with self.engine.connect() as conn:
                rules = conn.execute(
                    text("""
                        SELECT id, name, conditions, actions, priority
                        FROM automation_rules
                        WHERE trigger_type = :trigger_type AND enabled = 1
                        ORDER BY priority DESC
                    """),
                    {'trigger_type': trigger_type}
                ).fetchall()

            if not rules:
                logger.info(f"No rules found for trigger type: {trigger_type}")
                return results

            for rule in rules:
                results['rules_evaluated'] += 1

                conditions = json.loads(rule.conditions) if isinstance(rule.conditions, str) else rule.conditions

                if self.evaluate_conditions(conditions, context):
                    results['rules_matched'] += 1

                    actions = json.loads(rule.actions) if isinstance(rule.actions, str) else rule.actions

                    for action in actions:
                        action_result = self.execute_action(action, context)
                        action_result['rule_id'] = rule.id
                        action_result['rule_name'] = rule.name
                        results['action_results'].append(action_result)
                        results['actions_executed'] += 1

                        if not action_result.get('success', False) and config.get('stop_on_failure', False):
                            logger.warning(f"Action failed, stopping rule execution: {rule.name}")
                            break

        except Exception as e:
            logger.error(f"Error processing trigger {trigger_type}: {e}")
            results['error'] = str(e)

        return results
