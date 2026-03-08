import { useState } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { X, Plus, Calendar, Phone, Tag as TagIcon, Brain, Wifi, WifiOff, CheckCircle, Edit3, Save, XCircle, Loader2 } from 'lucide-react';
import { Conversation, Tag, AIStatus } from '@/lib/whatsapp-api';

type Props = {
  conversation: Conversation | null;
  tags: Tag[];
  aiStatus: AIStatus | null;
  waStatus: any;
  onClose?: () => void;
  onResolve?: (reviewId: string) => Promise<void>;
  onIdentifyLead?: (phone: string, fullName: string) => Promise<void>;
};

// Get AI status icon and color
function getAIStatusDisplay(status: AIStatus['status']) {
  switch (status) {
    case 'active':
      return { icon: Brain, color: 'text-emerald-500', label: 'IA Ativa' };
    case 'symbolic':
      return { icon: Brain, color: 'text-amber-500', label: 'IA Simbólica' };
    case 'offline':
    default:
      return { icon: Brain, color: 'text-red-500', label: 'IA Offline' };
  }
}

// Get WhatsApp status
function getWAStatusDisplay(status: string) {
  switch (status) {
    case 'connected':
      return { icon: Wifi, color: 'text-emerald-500', label: 'Conectado' };
    case 'connecting':
    case 'qr_ready':
      return { icon: Wifi, color: 'text-amber-500', label: 'Conectando...' };
    default:
      return { icon: WifiOff, color: 'text-red-500', label: 'Desconectado' };
  }
}

export function ContactSidebar({ conversation, tags, aiStatus, waStatus, onClose, onResolve, onIdentifyLead }: Props) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  // Get AI status
  const ai = aiStatus ? getAIStatusDisplay(aiStatus.status) : getAIStatusDisplay('offline');
  const AIIcon = ai.icon;

  // Get WA status
  const wa = waStatus ? getWAStatusDisplay(waStatus.status) : getWAStatusDisplay('disconnected');
  const WAIcon = wa.icon;

  // Get tags for this conversation
  const conversationTags = conversation?.tags || [];

  // Format phone to display name
  const displayName = conversation?.entity_name ||
    (conversation?.phone
      ? conversation.phone.replace('+', '').replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4')
      : '');

  const handleStartEdit = () => {
    setEditName(conversation?.entity_name || '');
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!conversation || !onIdentifyLead || !editName.trim()) return;
    setSaving(true);
    try {
      await onIdentifyLead(conversation.phone, editName.trim());
      setEditing(false);
    } catch (e) {
      console.error('Failed to save:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async () => {
    if (!conversation?.review_id || !onResolve) return;
    setResolving(true);
    try {
      await onResolve(conversation.review_id);
    } catch (e) {
      console.error('Failed to resolve:', e);
    } finally {
      setResolving(false);
    }
  };

  return (
    <GlassCard className="h-full flex flex-col !p-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold">Detalhes</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-secondary/50 rounded">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Avatar and Name */}
        {conversation ? (
          <>
            <div className="text-center">
              <div className="h-20 w-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                {displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>

              {editing ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome do lead..."
                    className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm outline-none text-center"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  />
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving || !editName.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-secondary/50 rounded-lg hover:bg-secondary"
                    >
                      <XCircle className="h-3 w-3" />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h4 className="mt-3 font-semibold">{displayName}</h4>
                  <p className="text-sm text-muted-foreground">{conversation.phone}</p>
                </>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 flex-wrap">
              <button className="flex-1 flex items-center justify-center gap-1 py-2 text-xs bg-secondary/50 rounded-lg hover:bg-secondary">
                <Calendar className="h-3 w-3" />
                Agendar
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 py-2 text-xs bg-secondary/50 rounded-lg hover:bg-secondary">
                <Phone className="h-3 w-3" />
                Ligar
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* Edit Lead Button */}
              {!editing && (
                <button
                  onClick={handleStartEdit}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                  Editar Lead
                </button>
              )}

              {/* Resolve Button */}
              {conversation.review_id && onResolve && (
                <button
                  onClick={handleResolve}
                  disabled={resolving}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                >
                  {resolving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3 w-3" />
                  )}
                  Resolver
                </button>
              )}
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">Tags</span>
                <button className="p-1 hover:bg-secondary/50 rounded">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {conversationTags.length > 0 ? (
                  conversationTags.map(tag => (
                    <span
                      key={tag.id}
                      className="px-2 py-1 text-xs rounded-full"
                      style={{ backgroundColor: tag.color + '30', color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Sem tags</p>
                )}
              </div>
            </div>

            {/* Classification */}
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase">Classificação</span>
              <p className="text-sm mt-1">
                {conversation.classification === 'known_client' && 'Cliente'}
                {conversation.classification === 'new_lead' && 'Lead'}
                {conversation.classification === 'unknown' && 'Desconhecido'}
                {!conversation.classification && 'Não classificado'}
              </p>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>Selecione uma conversa</p>
          </div>
        )}

        {/* System Status */}
        <div className="border-t border-border/30 pt-4">
          <span className="text-xs font-medium text-muted-foreground uppercase">Sistema</span>

          {/* AI Status */}
          <div className="flex items-center gap-2 mt-2">
            <AIIcon className={`h-4 w-4 ${ai.color}`} />
            <span className="text-sm">{ai.label}</span>
            {aiStatus?.gpu && (
              <span className="text-xs text-muted-foreground ml-auto">{aiStatus.gpu}</span>
            )}
          </div>

          {/* WhatsApp Status */}
          <div className="flex items-center gap-2 mt-2">
            <WAIcon className={`h-4 w-4 ${wa.color}`} />
            <span className="text-sm">{wa.label}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
