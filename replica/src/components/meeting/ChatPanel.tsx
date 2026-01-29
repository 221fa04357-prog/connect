import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Send, Paperclip, X, SmilePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types';

const reactionEmojis = ['👍', '👏', '❤️', '😂', '😮', '🎉', '😍', '🔥'];

export default function ChatPanel() {
  const { isChatOpen, toggleChat } = useMeetingStore();
  const { messages, activeTab, setActiveTab, sendMessage, markAsRead } = useChatStore();
  const { participants } = useParticipantsStore();
  const [input, setInput] = useState('');
  const [messageReactions, setMessageReactions] = useState<{ [key: string]: string[] }>({});
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isChatOpen) {
      markAsRead();
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isChatOpen, messages, markAsRead]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input, activeTab);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addReaction = (messageId: string, emoji: string) => {
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: prev[messageId] ? [...prev[messageId], emoji] : [emoji]
    }));
    setShowReactionPicker(null);
  };

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
          className="fixed right-0 top-0 bottom-0 w-full md:w-80 lg:w-96 bg-[#1C1C1C] border-l border-[#404040] z-30 flex flex-col"
        >
          {/* Header */}
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'public' | 'private')} className="flex-1 flex flex-col">
            <TabsList className="w-full bg-[#232323] rounded-none border-b border-[#404040]">
              <TabsTrigger value="public" className="flex-1">
                Public ({publicMessages.length})
              </TabsTrigger>
              <TabsTrigger value="private" className="flex-1">
                Private ({privateMessages.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="public" className="flex-1 overflow-hidden mt-0">
              <MessageList 
                messages={publicMessages} 
                messagesEndRef={messagesEndRef}
                messageReactions={messageReactions}
                onAddReaction={addReaction}
                showReactionPicker={showReactionPicker}
                setShowReactionPicker={setShowReactionPicker}
              />
            </TabsContent>

            <TabsContent value="private" className="flex-1 overflow-hidden mt-0">
              <MessageList 
                messages={privateMessages} 
                messagesEndRef={messagesEndRef}
                messageReactions={messageReactions}
                onAddReaction={addReaction}
                showReactionPicker={showReactionPicker}
                setShowReactionPicker={setShowReactionPicker}
              />
            </TabsContent>
          </Tabs>

          {/* Input */}
          <div className="p-4 border-t border-[#404040]">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-[#2D2D2D] flex-shrink-0"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="bg-[#232323] border-[#404040] focus-visible:ring-[#0B5CFF]"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim()}
                className="bg-[#0B5CFF] hover:bg-[#2D8CFF] flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MessageList({ 
  messages, 
  messagesEndRef, 
  messageReactions,
  onAddReaction,
  showReactionPicker,
  setShowReactionPicker
}: { 
  messages: ChatMessage[]
  messagesEndRef: React.RefObject<HTMLDivElement>
  messageReactions: { [key: string]: string[] }
  onAddReaction: (messageId: string, emoji: string) => void
  showReactionPicker: string | null
  setShowReactionPicker: (id: string | null) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((message) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex flex-col gap-1 group',
            message.senderId === 'current-user' && 'items-end'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{message.senderName}</span>
            <span className="text-xs text-gray-500">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="relative">
            <div
              className={cn(
                'max-w-[80%] rounded-lg p-3',
                message.senderId === 'current-user'
                  ? 'bg-[#0B5CFF] text-white'
                  : 'bg-[#232323]'
              )}
            >
              <p className="text-sm break-words">{message.content}</p>
            </div>

            {/* Reaction button */}
            <div className="absolute -bottom-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="relative">
                <button
                  onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                  className="p-1 hover:bg-[#2D2D2D] rounded"
                >
                  <SmilePlus className="w-4 h-4" />
                </button>

                <AnimatePresence>
                  {showReactionPicker === message.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute -top-12 right-0 bg-[#232323] rounded-lg p-2 flex gap-1 shadow-xl z-50"
                    >
                      {reactionEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => onAddReaction(message.id, emoji)}
                          className="text-xl hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Display reactions */}
          {(messageReactions[message.id] || message.reactions) && (
            <div className="flex gap-1 flex-wrap mt-2">
              {message.reactions?.map((reaction, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 bg-[#232323] rounded-full px-2 py-1 text-xs"
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-gray-400">{reaction.users.length}</span>
                </div>
              ))}
              {messageReactions[message.id]?.map((emoji, idx) => (
                <div
                  key={`user-reaction-${idx}`}
                  className="bg-[#232323] rounded-full px-2 py-1 text-xs"
                >
                  {emoji}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}