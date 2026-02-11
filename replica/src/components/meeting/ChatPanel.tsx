import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Send, SmilePlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';

/* ---------------- TYPES ---------------- */

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'public' | 'private';
  timestamp: Date;
  privateTo?: string;
}

/* ---------------- DEMO MESSAGES ---------------- */

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    senderId: 'user-1',
    senderName: 'Alice Johnson',
    content: 'Hello everyone 👋',
    type: 'public',
    timestamp: new Date(),
  },
  {
    id: '2',
    senderId: 'user-2',
    senderName: 'Bob Smith',
    content: 'Can you hear me?',
    type: 'public',
    timestamp: new Date(),
  },
];

const EMOJIS = ['😀', '😂', '😍', '👍', '🔥', '🎉', '😮', '❤️'];

/* ---------------- COMPONENT ---------------- */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ChatPanel() {
  const { isChatOpen, toggleChat } = useMeetingStore();
  const { participants } = useParticipantsStore();

  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ---------------- DERIVED COUNTS ---------------- */

  const publicMessages = messages.filter(m => m.type === 'public');

  // Count ALL private messages for user for the badge
  const totalPrivateMessages = messages.filter(m =>
    m.type === 'private' &&
    (m.senderId === 'current-user' || m.privateTo === 'current-user')
  ).length;

  // Filter private messages for the selected recipient
  const privateMessages = messages.filter(m =>
    m.type === 'private' &&
    (selectedRecipientId ? (
      (m.senderId === 'current-user' && m.privateTo === selectedRecipientId) ||
      (m.senderId === selectedRecipientId && m.privateTo === 'current-user')
    ) : false)
  );

  // Get potential recipients (everyone except self)
  // Assuming 'current-user' is the ID for the local user as per DEMO_MESSAGES. 
  // In a real app, use user.id from useAuthStore.
  const potentialRecipients = participants.filter(p => p.id !== 'current-user');

  // Recipient selection is now manual
  useEffect(() => {
    // We no longer auto-select the first recipient to allow "Select Participant" placeholder to show
  }, [activeTab]);


  /* ---------------- AUTO SCROLL ---------------- */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab, selectedRecipientId]);

  /* ---------------- SEND MESSAGE ---------------- */

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'current-user',
      senderName: 'You',
      content: input,
      type: activeTab,
      timestamp: new Date(),
      privateTo: activeTab === 'private' ? selectedRecipientId : undefined,
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setShowEmojiPicker(false);
  };

  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="
            fixed top-0 right-0 bottom-20
            w-full sm:w-[380px]
            bg-[#1C1C1C]
            border-l border-[#404040]
            rounded-none
            z-50
            flex flex-col
            overflow-hidden
            shadow-2xl
          "
        >
          {/* HEADER */}
          <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#404040]">
            <h3 className="text-lg font-semibold">Chat</h3>
            <Button variant="ghost" size="icon" onClick={toggleChat}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* TABS */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as 'public' | 'private');
            }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList className="shrink-0 w-full bg-[#232323] border-b border-[#404040]">
              <TabsTrigger value="public" className="flex-1">
                Public ({publicMessages.length})
              </TabsTrigger>
              <TabsTrigger value="private" className="flex-1">
                Private {totalPrivateMessages > 0 && `(${totalPrivateMessages})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="public"
              className="flex-1 min-h-0 mt-0 flex-col data-[state=active]:flex"
            >
              <MessageList
                messages={publicMessages}
                participants={participants}
                messagesEndRef={messagesEndRef}
              />
            </TabsContent>

            <TabsContent
              value="private"
              className="flex-1 min-h-0 mt-0 flex-col data-[state=active]:flex"
            >
              {/* Recipient Selector */}
              <div className="shrink-0 p-4 border-b border-[#333]">
                <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                  <SelectTrigger className="w-full bg-[#2A2A2A] border-[#444] text-white">
                    <SelectValue placeholder="Select Participant" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2A2A2A] border-[#444] text-white">
                    {potentialRecipients.length > 0 ? (
                      potentialRecipients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-gray-400">No participants</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <MessageList
                messages={privateMessages}
                participants={participants}
                messagesEndRef={messagesEndRef}
              />
            </TabsContent>
          </Tabs>

          {/* INPUT BAR */}
          <div className="shrink-0 bg-[#1C1C1C] p-4">
            {showEmojiPicker && (
              <div className="absolute left-8 bottom-[80px] flex gap-2">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => {
                      setInput(prev => prev + e);
                      setShowEmojiPicker(false);
                    }}
                    className="text-xl hover:scale-125 transition"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 bg-[#232323] border border-[#404040] rounded-xl px-3 py-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activeTab === 'private' ? "Type a private message..." : "Type a message..."}
                className="flex-1 bg-transparent border-none text-white focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />

              <Button variant="ghost" size="icon" onClick={() => setShowEmojiPicker(v => !v)}>
                <SmilePlus className="w-5 h-5" />
              </Button>

              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || (activeTab === 'private' && !selectedRecipientId)}
                className={cn(
                  input.trim() ? 'bg-[#0B5CFF]' : 'bg-[#2D2D2D]',
                  'text-white'
                )}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- MESSAGE LIST ---------------- */

function MessageList({
  messages,
  participants,
  messagesEndRef,
}: {
  messages: ChatMessage[];
  participants: { id: string; name: string }[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 no-scrollbar">
      {messages.map(msg => {
        const isMe = msg.senderId === 'current-user';

        return (
          <div
            key={msg.id}
            className={cn('flex flex-col gap-1', isMe ? 'items-end' : 'items-start')}
          >
            <div className="text-xs text-gray-400">
              {msg.senderName} •{' '}
              {msg.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>

            <div
              className={cn(
                'px-4 py-2 rounded-2xl text-sm max-w-[75%]',
                isMe
                  ? 'bg-[#0B5CFF] text-white rounded-br-none'
                  : 'bg-[#2A2A2A] text-gray-200 rounded-bl-none'
              )}
            >
              {msg.content}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
