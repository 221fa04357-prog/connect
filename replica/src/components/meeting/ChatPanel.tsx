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

export default function ChatPanel() {
  const { isChatOpen, toggleChat } = useMeetingStore();
  const { participants } = useParticipantsStore();

  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [privateTo, setPrivateTo] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ---------------- DERIVED COUNTS ---------------- */

  const publicMessages = messages.filter(m => m.type === 'public');
  const privateMessages = messages.filter(m => m.type === 'private');

  /* ---------------- AUTO SCROLL ---------------- */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

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
      privateTo: activeTab === 'private' ? privateTo ?? undefined : undefined,
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
            fixed top-0 right-0
            h-[calc(100vh-56px)]
            w-full sm:w-[380px]
            bg-[#1C1C1C]
            border-l border-[#404040]
            z-30
            flex flex-col
            overflow-x-hidden
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
              setPrivateTo(null);
            }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList className="shrink-0 w-full bg-[#232323] border-b border-[#404040]">
              <TabsTrigger value="public" className="flex-1">
                Public ({publicMessages.length})
              </TabsTrigger>
              <TabsTrigger value="private" className="flex-1">
                Private ({privateMessages.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="public" className="flex-1 min-h-0 data-[state=active]:flex">
              <MessageList
                messages={publicMessages}
                participants={participants}
                messagesEndRef={messagesEndRef}
              />
            </TabsContent>

            <TabsContent value="private" className="flex-1 min-h-0 data-[state=active]:flex">
              <MessageList
                messages={privateMessages}
                participants={participants}
                messagesEndRef={messagesEndRef}
              />
            </TabsContent>
          </Tabs>

          {/* INPUT BAR */}
          <div className="shrink-0 bg-[#1C1C1C] mx-6 mb-6 rounded-xl">
            {showEmojiPicker && (
              <div className="absolute left-8 bottom-[92px] flex gap-2">
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
                placeholder="Type a message..."
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
                disabled={!input.trim()}
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
