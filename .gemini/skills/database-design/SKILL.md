---
name: database-design
description: "Use this skill when designing databases - creating schemas, defining tables, choosing data types, setting up indexes, planning migrations, or optimizing queries."
---

# Database Design Patterns

## When to use this skill
- When creating new database tables
- When planning schema migrations
- When optimizing queries
- When setting up relationships between entities

## Schema Design Principles

### Naming Conventions
- Tables: plural, snake_case (`user_profiles`)
- Columns: snake_case (`created_at`)
- Primary keys: `id` (UUID preferred)
- Foreign keys: `entity_id` pattern

### Data Types
| Data | Type | Notes |
|------|------|-------|
| IDs | UUID | Use `uuid` or `String(36)` |
| Names | VARCHAR(255) | Full names, titles |
| Text | TEXT | Long content, descriptions |
| Dates | ISO8601 String | Use TEXT or TIMESTAMP |
| Booleans | INTEGER/BOOLEAN | 0/1 or true/false |
| JSON | JSON/JSONB | Flexible structured data |
| Money | DECIMAL(10,2) | Never use FLOAT |

## Relationship Patterns

### One-to-Many
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  total DECIMAL(10,2)
);
```

### Many-to-Many
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY
);

CREATE TABLE roles (
  id UUID PRIMARY KEY
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);
```

## Indexing Strategy

### When to Index
- Foreign keys (always)
- Columns used in WHERE clauses
- Columns used in JOINs
- Columns used in ORDER BY

### When NOT to Index
- Low-cardinality columns (gender, boolean)
- Frequently updated columns
- Large text columns (use full-text search instead)

## Migration Patterns

### Always Use
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- Idempotent operations

### Migration File Format
```sql
-- migration_001_feature.sql
-- Description: Adds users table
-- Created: 2026-03-07

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## Common Patterns

### Soft Deletes
```sql
ALTER TABLE users ADD COLUMN deleted_at TEXT;
-- Query: WHERE deleted_at IS NULL
```

### Timestamps
```sql
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
```

### Audit Trail
```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TEXT
);
```

## Query Optimization
1. Use EXPLAIN to analyze queries
2. Avoid SELECT * - specify columns
3. Use LIMIT for pagination
4. Batch inserts when possible
5. Use connection pooling
```
