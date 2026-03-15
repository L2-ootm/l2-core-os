import { useState, useRef, useEffect } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, Smile, Loader2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { Message, Conversation } from '@/lib/whatsapp-api';

type Props = {
  conversation: Conversation | null;
  messages: Message[];
  onSend: (message: string) => Promise<void>;
  sending: boolean;
};

export function MessageArea({ conversation, messages, onSend, sending }: Props) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = async () => {
    if (!message.trim() || sending) return;
    
    try {
      await onSend(message);
      setMessage('');
    } catch (e) {
      console.error('Failed to send:', e);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  if (!conversation) {
    return (
      <GlassCard className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-muted-foreground">Selecione uma conversa para começar</p>
        </div>
      </GlassCard>
    );
  }
  
  const displayName = conversation.entity_name || 
    conversation.phone.replace('+', '').replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4');
  
  return (
    <GlassCard className="h-full flex flex-col !p-0 overflow-hidden">
      <div className="p-3 border-b border-border/30 flex items-center gap-3 flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
          {displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <h3 className="font-semibold text-sm">{displayName}</h3>
          <p className="text-xs text-muted-foreground">{conversation.phone}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t border-border/30 flex-shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              className="w-full bg-secondary/50 rounded-xl px-4 py-2 text-sm outline-none resize-none"
              rows={1}
              disabled={sending}
            />
          </div>
          
          <button className="p-2 rounded-xl hover:bg-secondary/50 disabled:opacity-50" disabled={sending}>
            <Smile className="h-5 w-5" />
          </button>
          
          <button className="p-2 rounded-xl hover:bg-secondary/50 disabled:opacity-50" disabled={sending}>
            <Paperclip className="h-5 w-5" />
          </button>
          
          <button 
            className="p-2 rounded-xl bg-primary text-white disabled:opacity-50 flex items-center justify-center min-w-[40px]"
            onClick={handleSend}
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
