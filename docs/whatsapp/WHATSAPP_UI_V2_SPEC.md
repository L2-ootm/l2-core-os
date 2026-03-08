# WhatsApp UI v2 - Technical Specification

## Overview

Complete redesign of the WhatsApp page to match WhatsApp Web experience with two sections: pending messages and all conversations.

## Layout Structure

### Three-Column Layout

1. **Left Sidebar** (320px): Chat list with tabs
2. **Center** (flex-1): Message area
3. **Right Sidebar** (280px, collapsible): Contact details

### Responsive Breakpoints

- Desktop: > 1024px - Full 3 columns
- Tablet: 768-1024px - 2 columns (hide right sidebar)
- Mobile: < 768px - 1 column with bottom navigation

## Column 1: Chat List

### Header

- Search input with icon
- Tab switcher: "Pendentes" | "Todos"

### Tab: Pendentes

- Shows conversations needing attention
- Filter: status = pending, unresolved
- Sort: Most recent first

### Tab: Todos

- All conversations
- Sort: Most recent first
- Include resolved/archived

### Chat Item

- Avatar (48px): Lead photo or generated initials with gradient background
- Name: Lead name or formatted phone number
- Last message: Truncated preview (max 40 chars)
- Timestamp: HH:MM or DD/MM
- Unread badge: Count (if > 0)
- Status indicator: colored dot

### Avatar Colors (Auto-generated from phone)

- Hash phone number to select from 8-color palette
- Colors: Emerald, Blue, Purple, Pink, Orange, Red, Cyan, Amber

### Quick Actions (on hover)

- Archive
- Pin
- Delete
- Mark as read

## Column 2: Message Area

### Header

- Back button (mobile only)
- Avatar + Name + Phone
- Status: "online", "typing..."
- Actions: Search, Pin, More menu

### Message Bubbles

**Incoming** (left):
- Background: #f0f0f0 (light mode)
- Border-radius: 0 16px 16px 16px

**Outgoing** (right):
- Background: #dcf8c6 (WhatsApp green)
- Border-radius: 16px 0 16px 16px

**Elements per message:**
- Text content (supports multiline)
- Timestamp (bottom-right)
- Read receipts: single check (sent), double check (delivered), blue double check (read)
- Reply context (if replying to another message)

### Media Support

#### Images

- Thumbnail in chat (max 200px width)
- Click to open lightbox
- Lightbox: Full image, zoom, download button

#### Audio

- Waveform visualization
- Play/pause button
- Duration display
- Download button

#### Stickers

- Display as animated/static images
- Max size: 100px

#### Documents

- File icon based on type
- Filename + size
- Download button

#### Videos

- Thumbnail with play icon
- Click to open inline player
- Duration overlay

### Input Area

#### Text Input

- Multi-line, auto-expanding (max 6 lines)
- Placeholder: "Digite uma mensagem..."
- Emoji picker button
- Attachment button (image, document, audio)
- Send button (paper plane icon)
- Character counter (for long messages)

#### Action Buttons

- Emoji picker
- Attachment (photo, document, audio)
- Send (enabled when input not empty)

## Column 3: Contact Details (Right Sidebar)

### Header

- Large avatar (96px)
- Name (editable inline)
- Phone number
- Email (if known)

### Tags Section

- List of assigned tags
- Each tag: colored pill + name
- Add tag button (opens modal)
- Click tag to filter by tag

### Tag Management Modal

- List all tags with colors
- Create new tag (name + color picker)
- Edit existing tag
- Delete tag (with confirmation)
- Color palette: 12 colors

### Quick Info

- Lead score (if available)
- Classification: Cliente, Lead, Desconhecido
- Last contact date

### Notes Section

- Internal notes (not sent to WhatsApp)
- Textarea with save button
- Timestamp of last edit

### Action Buttons

- Schedule appointment
- Create task
- Add to pipeline

### Collapse/Expand

- Toggle button to hide sidebar
- Remember preference in localStorage

## Tags System

### Tag Definition

```typescript
interface Tag {
  id: string;
  name: string;
  color: string; // hex color
  created_at: string;
}
```

### Predefined Colors

```
#10b981 - Emerald
#3b82f6 - Blue
#8b5cf6 - Purple
#ec4899 - Pink
#f97316 - Orange
#ef4444 - Red
#06b6d4 - Cyan
#f59e0b - Amber
#84cc16 - Lime
#6366f1 - Indigo
#14b8a6 - Teal
#f43f5e - Rose
```

### Auto-Tags (AI Classification)

- urgente → Red tag
- agendamento → Blue tag
- pagamento → Green tag
- reclamação → Orange tag

## AI Auto-Lead Classification

### Trigger

- On new message from unknown lead
- Or manual trigger button

### Classification Types

```typescript
type ClassificationType =
  | 'emergencia'    // Emergency - red
  | 'agendamento'  // Scheduling - blue
  | 'pergunta'     // Question - gray
  | 'reclamacao'   // Complaint - orange
  | 'pagamento'    // Payment - green
  | 'geral';      // General - default
```

### UI Display

- Show classification badge on chat item
- Show confidence percentage
- Allow manual override

### Hardware Detection

- Check Ollama service status
- Check GPU availability
- Show AI status indicator:
  - 🟢 "IA Ativa" - Ollama running + GPU
  - 🟡 "IA Simbólica" - Ollama running, CPU only
  - 🔴 "IA Offline" - Ollama not responding
  - ⚪ "IA Desativada" - Feature disabled

## API Endpoints Required

### Conversations

- `GET /whatsapp/conversations` - List all conversations with pagination
- `GET /whatsapp/conversations/{phone}/messages` - Get messages for conversation
- `POST /whatsapp/conversations/{phone}/messages` - Send message

### Messages

- `GET /whatsapp/messages/{message_id}` - Get single message
- `DELETE /whatsapp/messages/{message_id}` - Delete message

### Tags

- `GET /tags` - List all tags
- `POST /tags` - Create tag
- `PUT /tags/{tag_id}` - Update tag
- `DELETE /tags/{tag_id}` - Delete tag
- `POST /entities/{entity_id}/tags` - Assign tags
- `DELETE /entities/{entity_id}/tags/{tag_id}` - Remove tag

### AI

- `GET /ai/status` - Check Ollama + GPU status
- `POST /ai/classify` - Classify lead/message

### Settings

- `GET /whatsapp/settings` - Get WhatsApp settings
- `PUT /whatsapp/settings` - Update settings

## Database Schema

### New Tables

```sql
-- Conversations (aggregated view)
CREATE TABLE whatsapp_conversations (
    phone TEXT PRIMARY KEY,
    entity_id TEXT,
    last_message_at TEXT,
    last_message_text TEXT,
    unread_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, archived
    created_at TEXT,
    updated_at TEXT
);

-- Messages (extended)
ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS media_type TEXT; -- image, audio, video, document, sticker
ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS message_type TEXT; -- incoming, outgoing

-- Tags
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT
);

-- Entity Tags (many-to-many)
CREATE TABLE entity_tags (
    entity_id TEXT,
    tag_id TEXT,
    assigned_at TEXT,
    PRIMARY KEY (entity_id, tag_id)
);
```

## State Management

### Local State

- `selectedConversation`: currently open chat
- `conversations`: list of all chats
- `messages`: messages for selected chat
- `searchQuery`: search filter
- `activeTab`: 'pendentes' | 'todos'
- `sidebarOpen`: right sidebar visibility

### Server State (React Query)

- Conversations list
- Messages per conversation
- Tags
- AI status

### Persisted (localStorage)

- Sidebar collapsed state
- Active tab
- Last selected conversation

## File Structure

```
apps/web-ui/src/
├── components/
│   └── WhatsApp/
│       ├── ChatList.tsx
│       ├── ChatListItem.tsx
│       ├── MessageArea.tsx
│       ├── MessageBubble.tsx
│       ├── MessageInput.tsx
│       ├── ContactSidebar.tsx
│       ├── TagPill.tsx
│       ├── TagManager.tsx
│       ├── MediaViewer.tsx
│       ├── AudioPlayer.tsx
│       └── WhatsAppLayout.tsx
├── hooks/
│   └── useWhatsApp.ts
├── lib/
│   └── whatsapp-api.ts
└── pages/
    └── WhatsAppInbox.tsx  (refactor)
```

## Implementation Priority

### Phase 1: Layout

1. Three-column structure
2. Responsive breakpoints

### Phase 2: Chat List

3. Tabs (pendentes/todos)
4. Chat items with avatars
5. Search

### Phase 3: Messages

6. Message bubbles
7. Input area

### Phase 4: Media

8. Image support
9. Audio support
10. Documents/stickers

### Phase 5: Right Sidebar

11. Contact info
12. Tags section

### Phase 6: AI Integration

13. Classification trigger
14. Status indicator

## Performance Considerations

1. Virtual scrolling for long conversation lists
2. Lazy load messages (pagination)
3. Compress images before upload
4. Debounce search input
5. Cache media locally
