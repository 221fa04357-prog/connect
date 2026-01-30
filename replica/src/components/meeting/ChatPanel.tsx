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
  privateTo?: string; // participant id
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

/* ---------------- EMOJIS ---------------- */

const EMOJIS = ['😀', '😂', '😍', '👍', '🔥', '🎉', '😮', '❤️'];

/* ---------------- COMPONENT ---------------- */

export default function ChatPanel() {
  const { isChatOpen, toggleChat } = useMeetingStore();
  const { participants } = useParticipantsStore();

  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [privateTo, setPrivateTo] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ---------------- AUTO SCROLL ---------------- */

  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  /* ---------------- SEND MESSAGE ---------------- */

  const handleSend = () => {
    if (!input.trim()) return;

    if (activeTab === 'private' && !privateTo) {
      alert('Please select a participant');
      return;
    }

    const receiver = participants.find(p => p.id === privateTo);

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'current-user',
      senderName: 'You',
      content: input,
      type: activeTab,
      timestamp: new Date(),
      privateTo: activeTab === 'private' ? privateTo ?? undefined : undefined,
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ---------------- FILTER ---------------- */

  const publicMessages = messages.filter(m => m.type === 'public');
  const privateMessages = messages.filter(m => m.type === 'private');

  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="
            fixed right-0 top-0 bottom-14
            w-[380px]
            bg-[#1C1C1C]
            border-l border-[#404040]
            z-30 flex flex-col
          "
        >
          {/* HEADER */}
          <div className="flex items-center justify-between p-4 border-b border-[#404040]">
            <h3 className="text-lg font-semibold">Chat</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleChat}
              className="hover:bg-[#2D2D2D]"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* TABS */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as 'public' | 'private');
              setPrivateTo(null);
            }}
            className="flex-1 flex flex-col"
          >
            <TabsList className="w-full bg-[#232323] rounded-none border-b border-[#404040]">
              <TabsTrigger
                value="public"
                className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-[#0B5CFF]"
              >
                Public ({publicMessages.length})
              </TabsTrigger>
              <TabsTrigger
                value="private"
                className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-[#0B5CFF]"
              >
                Private ({privateMessages.length})
              </TabsTrigger>
            </TabsList>

            {/* PRIVATE RECIPIENT SELECT */}
            {activeTab === 'private' && (
              <div className="p-3 border-b border-[#404040]">
                <label className="text-xs text-gray-400 mb-1 block">
                  Send private message to
                </label>

                <select
                  value={privateTo ?? ''}
                  onChange={(e) => setPrivateTo(e.target.value)}
                  className="w-full bg-[#232323] border border-[#404040] rounded px-2 py-1 text-sm"
                >
                  <option value="" disabled>
                    Select participant
                  </option>

                  {participants
                    .filter(p => p.id !== 'current-user')
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <TabsContent value="public" className="flex-1 overflow-hidden mt-0">
              <MessageList
                messages={publicMessages}
                participants={participants}
                messagesEndRef={messagesEndRef}
              />
            </TabsContent>

            <TabsContent value="private" className="flex-1 overflow-hidden mt-0">
              <MessageList
                messages={privateMessages}
                participants={participants}
                messagesEndRef={messagesEndRef}
              />
            </TabsContent>
          </Tabs>

          {/* INPUT */}
          <div className="px-4 pb-4 pt-2 bg-[#1C1C1C] sticky bottom-16 relative">
            {showEmojiPicker && (
              <div className="absolute bottom-20 right-4 bg-[#232323] border border-[#404040] rounded-lg p-2 flex gap-2 z-50">
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

            <div className="bg-[#232323] border border-[#404040] rounded-xl p-2 shadow-md">
              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeTab === 'private'
                      ? privateTo
                        ? `Message to ${participants.find(p => p.id === privateTo)?.name}`
                        : 'Select a participant'
                      : 'Type a message...'
                  }
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 text-white"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowEmojiPicker(v => !v)}
                >
                  <SmilePlus className="w-5 h-5" />
                </Button>

                <Button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  size="icon"
                  className={cn(
                    input.trim()
                      ? 'bg-[#0B5CFF] hover:bg-[#2D8CFF]'
                      : 'bg-[#2D2D2D]',
                    'text-white'
                  )}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
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
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map(msg => {
        const isMe = msg.senderId === 'current-user';
        const receiverName =
          msg.type === 'private'
            ? participants.find(p => p.id === msg.privateTo)?.name
            : null;

        return (
          <div
            key={msg.id}
            className={cn('flex flex-col gap-1', isMe ? 'items-end' : 'items-start')}
          >
            <div className="text-xs text-gray-400">
              {msg.senderName}
              {receiverName && <> → {receiverName}</>} •{' '}
              {msg.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>

            <div
              className={cn(
                'px-4 py-2 rounded-2xl text-sm max-w-[80%]',
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
