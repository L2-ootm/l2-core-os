import { Conversation, Tag } from '@/lib/whatsapp-api';

type Props = {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
};

// Generate avatar color from phone
function getAvatarColor(phone: string): string {
  const colors = [
    'bg-emerald-500',
    'bg-blue-500', 
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-cyan-500',
    'bg-amber-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Get initials from name
function getInitials(name: string | undefined, phone: string): string {
  if (!name) {
    // Format phone to show last 2 digits
    const digits = phone.replace(/\D/g, '');
    return digits.slice(-2) || '??';
  }
  
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Format timestamp
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Ontem';
  } else if (days < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}

export function ChatListItem({ conversation, isSelected, onClick }: Props) {
  const colorClass = getAvatarColor(conversation.phone);
  const initials = getInitials(conversation.entity_name, conversation.phone);
  
  // Format display name
  const displayName = conversation.entity_name || 
    conversation.phone.replace('+', '').replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4');
  
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
        isSelected 
          ? 'bg-primary/10 border-l-2 border-primary' 
          : 'hover:bg-secondary/30 border-l-2 border-transparent'
      }`}
    >
      {/* Avatar */}
      <div className={`h-12 w-12 rounded-full ${colorClass} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
        {initials}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {conversation.last_message_at && formatTimestamp(conversation.last_message_at)}
          </span>
        </div>
        
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {conversation.last_message_text || 'Sem mensagens'}
          </p>
          
          {/* Unread badge */}
          {conversation.unread_count > 0 && (
            <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </span>
          )}
        </div>
        
        {/* Tags */}
        {conversation.tags && conversation.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {conversation.tags.slice(0, 3).map(tag => (
              <span 
                key={tag.id}
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: tag.color + '30', color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
