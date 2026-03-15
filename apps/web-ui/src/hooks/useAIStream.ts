import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api';

export interface AIQueueStatus {
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  ollama: {
    running: boolean;
    models: string[];
  };
  mode: 'active' | 'symbolic' | 'offline';
}

export interface AIUpdate {
  queue_id: string;
  message_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  intent?: string;
  urgency?: number;
  sentiment?: string;
  summary?: string;
  confidence?: number;
  model_used?: string;
}

export function useAIStream() {
  const [status, setStatus] = useState<AIQueueStatus | null>(null);
  const [updates, setUpdates] = useState<AIUpdate[]>([]);
  const [connected, setConnected] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiGet<AIQueueStatus>('/ai/queue-status');
      setStatus(data);
    } catch (e) {
      console.error('Failed to fetch AI status:', e);
    }
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource('http://localhost:8000/ai/stream');
        
        eventSource.onopen = () => {
          setConnected(true);
          console.log('AI Stream connected');
        };

        eventSource.onmessage = (event) => {
          try {
            const data: AIUpdate = JSON.parse(event.data);
            setUpdates(prev => [data, ...prev].slice(0, 50));
            fetchStatus();
          } catch (e) {
            console.error('Failed to parse AI update:', e);
          }
        };

        eventSource.onerror = () => {
          setConnected(false);
          eventSource?.close();
          setTimeout(connect, 5000);
        };
      } catch (e) {
        console.error('Failed to connect to AI stream:', e);
      }
    };

    fetchStatus();
    connect();

    return () => {
      eventSource?.close();
    };
  }, [fetchStatus]);

  const classify = useCallback(async (messageId: string, phone: string, text: string) => {
    const result = await apiGet<{ id: string; status: string }>('/ai/classify', {
      message_id: messageId,
      phone,
      text
    } as any);
    return result;
  }, []);

  return {
    status,
    updates,
    connected,
    classify,
    refresh: fetchStatus
  };
}
