import { useState, useEffect, useCallback } from 'react';
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  getTags,
  getAIStatus,
  getWhatsAppStatus,
  resolveConversation as apiResolveConversation,
  identifyLead as apiIdentifyLead,
  Conversation,
  Message,
  Tag,
  AIStatus
} from '@/lib/whatsapp-api';

export function useWhatsApp() {
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [waStatus, setWaStatus] = useState<any>(null);

  // UI State
  const [tab, setTab] = useState<'pendentes' | 'todos'>('pendentes');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations(tab, search || undefined);
      setConversations(data);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  }, [tab, search]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (phone: string) => {
    try {
      const data = await getConversationMessages(phone);
      setMessages(data);
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  }, []);

  // Load tags
  const loadTags = useCallback(async () => {
    try {
      const data = await getTags();
      setTags(data);
    } catch (e) {
      console.error('Failed to load tags:', e);
    }
  }, []);

  // Load AI status
  const loadAIStatus = useCallback(async () => {
    try {
      const data = await getAIStatus();
      setAiStatus(data);
    } catch (e) {
      console.error('Failed to load AI status:', e);
    }
  }, []);

  // Load WhatsApp status
  const loadWAStatus = useCallback(async () => {
    try {
      const data = await getWhatsAppStatus();
      setWaStatus(data);
    } catch (e) {
      console.error('Failed to load WA status:', e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadConversations();
    loadTags();
    loadAIStatus();
    loadWAStatus();
  }, [loadConversations, loadTags, loadAIStatus, loadWAStatus]);

  // Load messages when phone changes
  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone);
    } else {
      setMessages([]);
    }
  }, [selectedPhone, loadMessages]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (selectedPhone) {
        loadMessages(selectedPhone);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadConversations, loadMessages, selectedPhone]);

  // Send message
  const send = useCallback(async (message: string) => {
    if (!selectedPhone || !message.trim()) return;

    setSending(true);
    try {
      await sendMessage(selectedPhone, message.trim());
      await loadMessages(selectedPhone);
      await loadConversations();
    } catch (e) {
      console.error('Failed to send message:', e);
      throw e;
    } finally {
      setSending(false);
    }
  }, [selectedPhone, loadMessages, loadConversations]);

  // Resolve conversation (mark as resolved in human review queue)
  const resolveConversation = useCallback(async (reviewId: string) => {
    try {
      await apiResolveConversation(reviewId);
      // Clear selection and reload
      setSelectedPhone(null);
      await loadConversations();
    } catch (e) {
      console.error('Failed to resolve conversation:', e);
      throw e;
    }
  }, [loadConversations]);

  // Identify / edit lead
  const identifyLead = useCallback(async (phone: string, fullName: string) => {
    try {
      await apiIdentifyLead(phone, fullName);
      await loadConversations();
    } catch (e) {
      console.error('Failed to identify lead:', e);
      throw e;
    }
  }, [loadConversations]);

  // Select conversation
  const selectPhone = useCallback((phone: string) => {
    setSelectedPhone(phone);
  }, []);

  return {
    // Data
    conversations,
    messages,
    tags,
    aiStatus,
    waStatus,

    // State
    selectedPhone,
    tab,
    search,
    loading,
    sending,
    sidebarOpen,

    // Actions
    setTab,
    setSearch,
    setSidebarOpen,
    selectPhone,
    send,
    resolveConversation,
    identifyLead,
    loadConversations,
    loadTags,
    loadAIStatus,
    loadWAStatus,
  };
}
