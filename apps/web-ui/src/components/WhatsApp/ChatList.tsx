import { useState } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { Search, Loader2 } from 'lucide-react';
import { ChatListItem } from './ChatListItem';
import { Conversation } from '@/lib/whatsapp-api';

type Props = {
  conversations: Conversation[];
  selectedPhone?: string | null;
  onSelectPhone: (phone: string) => void;
  tab: 'pendentes' | 'todos';
  onTabChange: (tab: 'pendentes' | 'todos') => void;
  search: string;
  onSearchChange: (search: string) => void;
  loading: boolean;
};

export function ChatList({ 
  conversations, 
  selectedPhone, 
  onSelectPhone, 
  tab, 
  onTabChange,
  search,
  onSearchChange,
  loading 
}: Props) {
  return (
    <GlassCard className="h-full flex flex-col !p-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border/30 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-secondary/50 rounded-xl pl-10 pr-4 py-2 text-sm outline-none"
          />
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => onTabChange('pendentes')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === 'pendentes' 
                ? 'bg-primary text-white' 
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => onTabChange('todos')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === 'todos' 
                ? 'bg-primary text-white' 
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            Todos
          </button>
        </div>
      </div>
      
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nenhuma conversa encontrada
          </div>
        ) : (
          conversations.map((conv) => (
            <ChatListItem
              key={conv.phone}
              conversation={conv}
              isSelected={selectedPhone === conv.phone}
              onClick={() => onSelectPhone(conv.phone)}
            />
          ))
        )}
      </div>
    </GlassCard>
  );
}
