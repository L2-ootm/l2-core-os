import { apiGet, apiPost } from './api';

// Types
export interface Conversation {
  phone: string;
  entity_id?: string;
  entity_name?: string;
  review_id?: string;
  last_message_at: string;
  last_message_text?: string;
  unread_count: number;
  status: 'active' | 'archived' | 'pending' | 'resolved';
  classification?: string;
  tags?: Tag[];
}

export interface Message {
  id: string;
  phone: string;
  text?: string;
  media_url?: string;
  media_type?: 'image' | 'audio' | 'video' | 'document' | 'sticker';
  message_type: 'incoming' | 'outgoing';
  timestamp: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface AIStatus {
  status: 'active' | 'symbolic' | 'offline';
  has_gpu: boolean;
  gpu?: string;
  model_loaded?: string;
  available_models?: string[];
}

// Conversations
export async function getConversations(tab: 'pendentes' | 'todos' = 'todos', search?: string): Promise<Conversation[]> {
  const params = new URLSearchParams({ tab });
  if (search) params.append('search', search);
  const result = await apiGet<{ ok: boolean; items: Conversation[] }>(`/whatsapp/conversations?${params}`);
  return result.items || [];
}

export async function getConversationMessages(phone: string, limit = 50): Promise<Message[]> {
  const result = await apiGet<{ ok: boolean; messages: Message[] }>(`/whatsapp/conversations/${encodeURIComponent(phone)}/messages?limit=${limit}`);
  return result.messages || [];
}

export async function sendMessage(phone: string, message: string): Promise<{ ok: boolean }> {
  return apiPost('/whatsapp/send', {
    phone,
    message,
    idempotency_key: crypto.randomUUID(),
  });
}

// Resolve conversation (mark pending lead as resolved)
export async function resolveConversation(reviewId: string): Promise<{ ok: boolean }> {
  return apiPost(`/human-review/${reviewId}/resolve?decision=resolved`, {});
}

// Identify / edit lead
export async function identifyLead(phone: string, fullName: string, notes?: string): Promise<{ ok: boolean; entity_id: string }> {
  return apiPost('/ops/leads/identify', { phone, full_name: fullName, notes });
}

// Tags
export async function getTags(): Promise<Tag[]> {
  const result = await apiGet<{ ok: boolean; items: Tag[] }>('/tags');
  return result.items || [];
}

export async function createTag(name: string, color: string): Promise<Tag> {
  return apiPost('/tags', { name, color });
}

export async function updateTag(tagId: string, name: string, color: string): Promise<Tag> {
  return apiPost(`/tags/${tagId}`, { name, color });
}

export async function deleteTag(tagId: string): Promise<void> {
  return apiPost(`/tags/${tagId}/delete`, {});
}

export async function assignTagsToEntity(entityId: string, tagIds: string[]): Promise<void> {
  return apiPost(`/entities/${entityId}/tags`, { tag_ids: tagIds });
}

export async function removeTagFromEntity(entityId: string, tagId: string): Promise<void> {
  return apiPost(`/entities/${entityId}/tags/${tagId}/remove`, {});
}

export async function getEntityTags(entityId: string): Promise<Tag[]> {
  const result = await apiGet<{ ok: boolean; items: Tag[] }>(`/entities/${entityId}/tags`);
  return result.items || [];
}

// AI Status
export async function getAIStatus(): Promise<AIStatus> {
  return apiGet('/ai/status');
}

// WhatsApp Status
export async function getWhatsAppStatus() {
  try {
    const r = await fetch('/wa/session/status');
    if (r.ok) return r.json();
    return { status: 'disconnected' };
  } catch {
    return { status: 'disconnected' };
  }
}

export async function connectWhatsApp() {
  return apiPost('/session/connect', {});
}

export async function disconnectWhatsApp(clearAuth = false) {
  return apiPost('/session/disconnect', { clearAuth });
}
