import { GlassCard } from '@/components/ui/glass-card';
import { ChatList } from './ChatList';
import { MessageArea } from './MessageArea';
import { ContactSidebar } from './ContactSidebar';
import { Conversation, Message, Tag, AIStatus } from '@/lib/whatsapp-api';

type Props = {
  // Data
  conversations: Conversation[];
  messages: Message[];
  tags: Tag[];
  aiStatus: AIStatus | null;
  waStatus: any;

  // Selected
  selectedPhone: string | null;

  // UI State
  tab: 'pendentes' | 'todos';
  search: string;
  loading: boolean;
  sending: boolean;
  sidebarOpen: boolean;

  // Actions
  onSelectPhone: (phone: string) => void;
  onTabChange: (tab: 'pendentes' | 'todos') => void;
  onSearchChange: (search: string) => void;
  onSend: (message: string) => Promise<void>;
  onSidebarToggle: () => void;
  onResolve: (reviewId: string) => Promise<void>;
  onIdentifyLead: (phone: string, fullName: string) => Promise<void>;
};

export function WhatsAppLayout({
  conversations,
  messages,
  tags,
  aiStatus,
  waStatus,
  selectedPhone,
  tab,
  search,
  loading,
  sending,
  sidebarOpen,
  onSelectPhone,
  onTabChange,
  onSearchChange,
  onSend,
  onSidebarToggle,
  onResolve,
  onIdentifyLead,
}: Props) {
  // Get selected conversation
  const selectedConversation = conversations.find(c => c.phone === selectedPhone) || null;

  return (
    <div className="flex h-[calc(100vh-110px)] gap-4">
      {/* Left Sidebar - Chat List */}
      <div className="w-80 flex-shrink-0">
        <ChatList
          conversations={conversations}
          selectedPhone={selectedPhone}
          onSelectPhone={onSelectPhone}
          tab={tab}
          onTabChange={onTabChange}
          search={search}
          onSearchChange={onSearchChange}
          loading={loading}
        />
      </div>

      {/* Center - Messages */}
      <div className="flex-1 min-w-0">
        <MessageArea
          conversation={selectedConversation}
          messages={messages}
          onSend={onSend}
          sending={sending}
        />
      </div>

      {/* Right Sidebar - Contact Details */}
      {sidebarOpen && (
        <div className="w-72 flex-shrink-0">
          <ContactSidebar
            conversation={selectedConversation}
            tags={tags}
            aiStatus={aiStatus}
            waStatus={waStatus}
            onClose={onSidebarToggle}
            onResolve={onResolve}
            onIdentifyLead={onIdentifyLead}
          />
        </div>
      )}
    </div>
  );
}
