import { Message } from '@/lib/whatsapp-api';
import { Check, CheckCheck } from 'lucide-react';

type Props = {
  message: Message;
};

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function MessageBubble({ message }: Props) {
  const isOutgoing = message.message_type === 'outgoing';

  // Media component
  const renderMedia = () => {
    if (!message.media_url) return null;

    switch (message.media_type) {
      case 'image':
        return (
          <div className="mt-1">
            <img
              src={message.media_url}
              alt="Image"
              className="max-w-[250px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.media_url, '_blank')}
            />
          </div>
        );

      case 'audio':
        return (
          <div className="mt-1 flex items-center gap-2 bg-black/5 p-2 rounded-lg">
            <button className="p-1 rounded-full bg-primary/20 hover:bg-primary/30">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <div className="flex-1 h-1 bg-primary/20 rounded-full">
              <div className="h-full w-1/3 bg-primary rounded-full" />
            </div>
            <span className="text-xs text-muted-foreground">0:15</span>
          </div>
        );

      case 'video':
        return (
          <div className="mt-1 relative">
            <video
              src={message.media_url}
              className="max-w-[250px] rounded-lg"
              controls
            />
          </div>
        );

      case 'document':
        return (
          <div className="mt-1 flex items-center gap-2 bg-black/5 p-2 rounded-lg">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">document.pdf</p>
              <p className="text-[10px] text-muted-foreground">2.4 MB</p>
            </div>
          </div>
        );

      case 'sticker':
        return (
          <div className="mt-1">
            <img
              src={message.media_url}
              alt="Sticker"
              className="w-20 h-20"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isOutgoing
          ? 'bg-primary/20 text-foreground rounded-[16px_16px_0_16px]'
          : 'bg-secondary text-foreground rounded-[16px_16px_16px_0]'
        } px-4 py-2`}>
        {/* Text content */}
        {message.text && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.text}
          </p>
        )}

        {/* Media */}
        {renderMedia()}

        {/* Timestamp and status */}
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutgoing ? 'text-primary/70' : 'text-muted-foreground'
          }`}>
          <span className="text-[10px]">{formatTime(message.timestamp)}</span>

          {isOutgoing && (
            <CheckCheck className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  );
}
