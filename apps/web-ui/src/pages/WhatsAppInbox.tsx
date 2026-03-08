import { LoadingState } from "@/components/ui/async-state";
import { WhatsAppLayout } from "@/components/WhatsApp";
import { useWhatsApp } from "@/hooks/useWhatsApp";

export default function WhatsAppInbox() {
  const {
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
    setTab,
    setSearch,
    setSidebarOpen,
    selectPhone,
    send,
    resolveConversation,
    identifyLead,
  } = useWhatsApp();

  if (loading && conversations.length === 0) {
    return <LoadingState label="Carregando conversas..." />;
  }

  return (
    <div className="animate-in-fade">
      <WhatsAppLayout
        conversations={conversations}
        messages={messages}
        tags={tags}
        aiStatus={aiStatus}
        waStatus={waStatus}
        selectedPhone={selectedPhone}
        tab={tab}
        search={search}
        loading={loading}
        sending={sending}
        sidebarOpen={sidebarOpen}
        onSelectPhone={selectPhone}
        onTabChange={setTab}
        onSearchChange={setSearch}
        onSend={send}
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
        onResolve={resolveConversation}
        onIdentifyLead={identifyLead}
      />
    </div>
  );
}
