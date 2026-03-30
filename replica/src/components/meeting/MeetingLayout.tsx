import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui';
import {
    Send, SmilePlus, X, Search, Mic, MicOff, Video, VideoOff,
    Hand, MoreVertical, Crown, Shield, Sparkles, Copy, ThumbsUp,
    ThumbsDown, Bot, ListTodo, FileText, MessageSquare, Check,
    Plus, AlertCircle, Download, Lock as LockIcon, ChevronDown,
    Pin, Reply, Trash2, Circle, Paperclip, Edit2, Ban, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VideoStartRequestPopup } from './VideoStartRequestPopup';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useChatStore } from '@/stores/useChatStore';
import { RemoteControlStream } from './RemoteControlStream';
import { useAIStore } from '@/stores/useAIStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { ChatMessage, Participant, Meeting } from '@/types';
import { useResourceStore } from '@/stores/useResourceStore';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = import.meta.env.VITE_API_URL || '';

/* -------------------------------------------------------------------------------------------------
 * CHAT PANEL
 * ------------------------------------------------------------------------------------------------- */

const EMOJIS = ['😀', '😂', '😍', '👍', '🔥', '🎉', '😮', '❤️'];

export function ChatPanel() {
    const { isChatOpen, toggleChat } = useMeetingStore();
    const { participants } = useParticipantsStore();
    const {
        messages,
        sendMessage,
        sendTypingStatus,
        markAsRead,
        typingUsers,
        activeTab,
        setActiveTab,
        selectedRecipientId,
        setSelectedRecipientId,
        smartReplies,
        fetchSmartReplies,
        isFetchingSmartReplies
    } = useChatStore();
    const { meeting, isJoinedAsHost } = useMeetingStore();

    const isHostOrCoHost = isJoinedAsHost; // Simplified for this component context
    const chatAllowed = isHostOrCoHost || meeting?.settings?.chatAllowed !== false;
    const documentShareAllowed = isHostOrCoHost || meeting?.settings?.allowDocumentShare !== false;

    const [input, setInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentUser = useAuthStore.getState().user;
    const currentUserId = currentUser?.id || 'current-user';

    /* ---------------- DERIVED DATA ---------------- */

    const publicMessages = messages.filter(m => m.type === 'public');
    const pinnedMessages = messages.filter(m => m.isPinned);

    // Count ALL private messages for user for the badge
    const totalPrivateMessages = messages.filter(m =>
        m.type === 'private' &&
        (m.senderId === currentUserId || m.recipientId === currentUserId)
    ).length;

    // Filter private messages: Show ALL private messages for the current user (unified view)
    const privateMessages = messages.filter(m =>
        m.type === 'private' &&
        (m.senderId === currentUserId || m.recipientId === currentUserId)
    );

    // Get potential recipients (everyone except self)
    const potentialRecipients = participants.filter(p => p.id !== currentUserId);

    // Recipient selection is now manual
    useEffect(() => {
        // We no longer auto-select the first recipient to allow "Select Participant" placeholder to show
    }, [activeTab]);


    /* ---------------- AUTO SCROLL & MARK AS READ ---------------- */

    useEffect(() => {
        if (isChatOpen) {
            markAsRead();
        }
    }, [isChatOpen, markAsRead]);

    // Fetch smart replies when messages change
    useEffect(() => {
        if (!isChatOpen || messages.length === 0) return;

        const lastMessages = messages
            .filter(m => m.type === 'public')
            .slice(-5)
            .map(m => `${m.senderName}: ${m.content}`)
            .join('\n');

        if (lastMessages) {
            const timeoutId = setTimeout(() => {
                fetchSmartReplies(lastMessages);
            }, 1000);
            return () => clearTimeout(timeoutId);
        }
    }, [messages.length, isChatOpen]);

    /* ---------------- VOICE DICTATION LOGIC ---------------- */

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false; // Stop automatically after speech ends
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: any) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (finalTranscript) {
                    setInput(prev => {
                        const trimmed = prev.trim();
                        return trimmed ? trimmed + ' ' + finalTranscript : finalTranscript;
                    });
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                if (event.error === 'no-speech') return; // Ignore silent periods
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
                toast.error(`Voice input error: ${event.error}`);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            toast.error("Speech recognition is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
                toast.success("Listening...");
            } catch (err) {
                console.error("Failed to start recognition:", err);
            }
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeTab, selectedRecipientId, typingUsers]);

    /* ---------------- SEND MESSAGE ---------------- */

    const handleSend = () => {
        if (!input.trim()) return;
        if (!chatAllowed) {
            toast.error('Host has disabled chat.');
            return;
        }

        const replyData = replyingTo ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            content: replyingTo.content
        } : undefined;

        sendMessage(input, activeTab, activeTab === 'private' ? selectedRecipientId : undefined, replyData);
        setInput('');
        setReplyingTo(null);
        setShowEmojiPicker(false);
        sendTypingStatus(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);

        // Typing indicator
        if (val.length > 0) {
            sendTypingStatus(true);
        } else {
            sendTypingStatus(false);
        }
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
                        {/* Close button moved to TopBar */}
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
                            {/* Pinned Messages Header */}
                            {pinnedMessages.filter(m => m.type === 'public').length > 0 && (
                                <div className="bg-[#232323] border-b border-[#404040] p-2 flex items-center gap-2">
                                    <Pin className="w-3 h-3 text-blue-400 rotate-45 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-blue-400 font-medium">Pinned Message</p>
                                        <p className="text-xs text-gray-300 truncate">
                                            {pinnedMessages.filter(m => m.type === 'public')[pinnedMessages.filter(m => m.type === 'public').length - 1].content}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const lastPinned = pinnedMessages.filter(m => m.type === 'public')[pinnedMessages.filter(m => m.type === 'public').length - 1];
                                            useChatStore.getState().unpinMessage(lastPinned.id);
                                        }}
                                        className="text-gray-500 hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            <MessageList
                                messages={publicMessages}
                                participants={participants}
                                messagesEndRef={messagesEndRef}
                                onReply={(msg) => setReplyingTo(msg)}
                            />
                        </TabsContent>

                        <TabsContent
                            value="private"
                            className="flex-1 min-h-0 mt-0 flex-col data-[state=active]:flex"
                        >
                            {/* Pinned Messages Header (Private) */}
                            {selectedRecipientId && pinnedMessages.filter(m =>
                                m.type === 'private' &&
                                (m.senderId === selectedRecipientId || m.recipientId === selectedRecipientId)
                            ).length > 0 && (
                                    <div className="bg-[#232323] border-b border-[#404040] p-2 flex items-center gap-2">
                                        <Pin className="w-3 h-3 text-blue-400 rotate-45 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-blue-400 font-medium">Pinned Private Message</p>
                                            <p className="text-xs text-gray-300 truncate">
                                                {
                                                    pinnedMessages.filter(m =>
                                                        m.type === 'private' &&
                                                        (m.senderId === selectedRecipientId || m.recipientId === selectedRecipientId)
                                                    ).slice(-1)[0].content
                                                }
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const lastPinned = pinnedMessages.filter(m =>
                                                    m.type === 'private' &&
                                                    (m.senderId === selectedRecipientId || m.recipientId === selectedRecipientId)
                                                ).slice(-1)[0];
                                                useChatStore.getState().unpinMessage(lastPinned.id);
                                            }}
                                            className="text-gray-500 hover:text-white"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}

                            {/* Recipient Selector */}
                            <div className="shrink-0 p-4 border-b border-[#333]">
                                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={searchOpen}
                                            className="w-full justify-between bg-[#2A2A2A] border-[#444] text-white hover:bg-[#333] hover:text-white font-normal"
                                        >
                                            <span className="truncate">
                                                {selectedRecipientId
                                                    ? potentialRecipients.find((p) => p.id === selectedRecipientId)?.name
                                                    : "Select Participant"}
                                            </span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-[#2A2A2A] border-[#444] z-[1001]" align="start">
                                        <Command className="bg-[#2A2A2A] text-white">
                                            <CommandInput placeholder="Search participant..." className="h-9 text-white" />
                                            <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                                <CommandEmpty className="p-2 text-sm text-gray-400">No participants found.</CommandEmpty>
                                                <CommandGroup>
                                                    {potentialRecipients.map((p) => (
                                                        <CommandItem
                                                            key={p.id}
                                                            value={p.name}
                                                            onSelect={() => {
                                                                setSelectedRecipientId(p.id);
                                                                setSearchOpen(false);
                                                            }}
                                                            className="text-white hover:bg-[#333] cursor-pointer flex items-center px-2 py-1.5"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4 text-blue-500",
                                                                    selectedRecipientId === p.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <span className="truncate">{p.name}</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <MessageList
                                messages={privateMessages}
                                participants={participants}
                                messagesEndRef={messagesEndRef}
                                onReply={(msg) => setReplyingTo(msg)}
                                onMessageClick={(userId) => {
                                    if (userId !== currentUserId) {
                                        setSelectedRecipientId(userId);
                                    }
                                }}
                            />
                        </TabsContent>
                    </Tabs>

                    {/* SMART REPLIES */}
                    {!isFetchingSmartReplies && smartReplies.length > 0 && chatAllowed && (
                        <div className="px-4 pb-2 flex flex-wrap gap-2">
                            {smartReplies.map((reply, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setInput(reply)}
                                    className="bg-[#2A2A2A] hover:bg-[#333] border border-[#444] text-xs text-blue-300 px-3 py-1.5 rounded-full transition-all active:scale-95"
                                >
                                    {reply}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* INPUT BAR */}
                    <div className="shrink-0 bg-[#1C1C1C] p-4 pt-2">
                        {/* Reply Indicator */}
                        {replyingTo && (
                            <div className="flex items-center justify-between bg-[#232323] border-l-2 border-blue-500 p-2 mb-2 rounded-r-md">
                                <div className="min-w-0">
                                    <p className="text-[10px] text-blue-400 font-medium">Replying to {replyingTo.senderName}</p>
                                    <p className="text-xs text-gray-400 truncate">{replyingTo.content}</p>
                                </div>
                                <button
                                    onClick={() => setReplyingTo(null)}
                                    className="text-gray-500 hover:text-white p-1"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

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
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleListening}
                                disabled={!chatAllowed}
                                className={cn(
                                    "transition-all",
                                    isListening ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-white"
                                )}
                            >
                                <Mic className="w-5 h-5" />
                            </Button>

                            <Input
                                value={input}
                                onChange={handleInputChange}
                                placeholder={!chatAllowed ? "Chat is disabled by host" : (activeTab === 'private' ? "Type a private message..." : "Type a message...")}
                                className="flex-1 bg-transparent border-none text-white focus-visible:ring-0"
                                disabled={!chatAllowed}
                                onBlur={() => sendTypingStatus(false)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />

                            <Button variant="ghost" size="icon" onClick={() => setShowEmojiPicker(v => !v)} disabled={!chatAllowed}>
                                <SmilePlus className="w-5 h-5" />
                            </Button>

                            <Button
                                size="icon"
                                onClick={handleSend}
                                disabled={!chatAllowed || !input.trim() || (activeTab === 'private' && !selectedRecipientId)}
                                className={cn(
                                    input.trim() && chatAllowed ? 'bg-[#0B5CFF]' : 'bg-[#2D2D2D]',
                                    'text-white transition-colors duration-200'
                                )}
                            >
                                {!chatAllowed ? <LockIcon className="w-4 h-4" /> : <Send className="w-4 h-4" />}
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
    participants,
    messagesEndRef,
    onMessageClick,
    onReply,
}: {
    messages: ChatMessage[];
    participants: { id: string; name: string }[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onMessageClick?: (userId: string) => void;
    onReply?: (message: ChatMessage) => void;
}) {
    const { typingUsers, pinMessage, unpinMessage, addReaction } = useChatStore();
    const { user } = useAuthStore();
    const currentUserId = user?.id || 'current-user';

    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
    const { deleteMessageForMe, deleteMessageForEveryone } = useChatStore();

    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 no-scrollbar">
            {messages.filter(m => !m.deletedFor?.includes(currentUserId)).map(msg => {
                const isMe = msg.senderId === currentUserId;

                let displayName = msg.senderName;
                if (msg.type === 'private') {
                    if (isMe) {
                        const recipient = participants.find(p => p.id === msg.recipientId);
                        displayName = `You → ${recipient ? recipient.name : (msg.recipientName || 'Unknown')}`;
                    } else {
                        displayName = `${msg.senderName} → You`;
                    }
                }

                return (
                    <div
                        key={msg.id}
                        className={cn('flex flex-col gap-1 relative group', isMe ? 'items-end' : 'items-start')}
                        onMouseEnter={() => setHoveredMessageId(msg.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                    >
                        {/* Pinned Indicator */}
                        {msg.isPinned && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-400 mb-1">
                                <Pin className="w-3 h-3 rotate-45" />
                                <span>Pinned</span>
                            </div>
                        )}

                        <div className="text-xs text-gray-400 flex items-center gap-2">
                            {displayName} •{' '}
                            {msg.timestamp.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            })}
                        </div>

                        {/* Reply Preview */}
                        {msg.replyTo && (
                            <div className={cn(
                                "text-[11px] p-2 border-l-2 bg-black/20 mb-[-8px] rounded-t-lg max-w-[75%] truncate",
                                isMe ? "border-blue-500" : "border-gray-500"
                            )}>
                                <span className="font-semibold block">{msg.replyTo.senderName}</span>
                                <span className="opacity-70">{msg.replyTo.content}</span>
                            </div>
                        )}

                        <div className="relative flex items-center group/msg">
                            {/* Actions on hover */}
                            <div className={cn(
                                "absolute top-[-24px] z-20 opacity-0 group-hover:opacity-100 transition-opacity",
                                isMe ? "right-0" : "left-0"
                            )}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center justify-center bg-[#1C1C1C] border border-[#404040] rounded-full h-8 w-8 text-gray-400 hover:text-white hover:bg-[#333] transition-colors shadow-lg">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align={isMe ? "end" : "start"} className="w-56 bg-[#232323] border-[#404040] text-gray-200 p-1">
                                        <div className="flex items-center justify-between px-2 py-2 border-b border-[#333] mb-1">
                                            {EMOJIS.slice(0, 6).map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => addReaction(msg.id, emoji)}
                                                    className="hover:scale-125 transition-transform text-lg p-1 rounded-md hover:bg-[#333]"
                                                    title={emoji}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                        <DropdownMenuItem
                                            onClick={() => onReply?.(msg)}
                                            className="hover:bg-[#333] focus:bg-[#333] cursor-pointer py-2.5"
                                        >
                                            <Reply className="w-4 h-4 mr-2" />
                                            <span>Reply</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => msg.isPinned ? unpinMessage(msg.id) : pinMessage(msg.id)}
                                            className="hover:bg-[#333] focus:bg-[#333] cursor-pointer py-2.5"
                                        >
                                            <Pin className={cn("w-4 h-4 mr-2", msg.isPinned && "text-blue-400")} />
                                            <span>{msg.isPinned ? "Unpin Message" : "Pin Message"}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-[#333]" />
                                        <DropdownMenuItem
                                            onClick={() => deleteMessageForMe(msg.id)}
                                            className="hover:bg-red-500/10 focus:bg-red-500/10 text-red-400 cursor-pointer py-2.5"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            <span>Delete for Me</span>
                                        </DropdownMenuItem>
                                        {isMe && (
                                            <DropdownMenuItem
                                                onClick={() => deleteMessageForEveryone(msg.id)}
                                                className="hover:bg-red-500/10 focus:bg-red-500/10 text-red-500 cursor-pointer py-2.5"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                <span>Delete for Everyone</span>
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div
                                className={cn(
                                    'px-4 py-2 rounded-2xl text-sm max-w-full cursor-pointer transition-colors break-words',
                                    isMe
                                        ? 'bg-[#0B5CFF] text-white rounded-br-none hover:bg-[#0046D5]'
                                        : 'bg-[#2A2A2A] text-gray-200 rounded-bl-none hover:bg-[#333]',
                                    msg.replyTo && "rounded-tr-none"
                                )}
                                onClick={() => {
                                    if (msg.type === 'private' && onMessageClick) {
                                        onMessageClick(isMe ? (msg.recipientId || '') : msg.senderId);
                                    }
                                }}
                            >
                                {msg.isDeletedEveryone ? (
                                    <span className="italic opacity-60 flex items-center gap-1.5">
                                        <X className="w-3 h-3" /> This message was deleted
                                    </span>
                                ) : msg.content}
                            </div>
                        </div>

                        {/* Reactions */}
                        {msg.reactions && msg.reactions.length > 0 && (
                            <div className={cn("flex flex-wrap gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
                                {msg.reactions.map(r => (
                                    <button
                                        key={r.emoji}
                                        onClick={() => addReaction(msg.id, r.emoji)}
                                        className={cn(
                                            "flex items-center gap-1 bg-[#232323] border border-[#404040] rounded-full px-1.5 py-0.5 text-[10px] hover:bg-[#333] transition-colors",
                                            r.users.includes(currentUserId) ? "border-blue-500 text-blue-400" : "text-gray-400"
                                        )}
                                    >
                                        <span>{r.emoji}</span>
                                        <span>{r.users.length}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
                <div className="flex flex-col items-start gap-1">
                    <div className="text-[10px] text-gray-500 italic">
                        {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </div>
                    <div className="bg-[#2A2A2A] px-3 py-2 rounded-2xl rounded-bl-none flex gap-1 items-center h-[30px]">
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
}

/* -------------------------------------------------------------------------------------------------
 * PARTICIPANTS PANEL
 * ------------------------------------------------------------------------------------------------- */

export function ParticipantsPanel() {
    const { isParticipantsOpen, toggleParticipants } = useMeetingStore();
    const { nativeAgentStatus, localUserId, frequentQuestionUsers, setFrequentQuestionUsers, socket } = useChatStore();

    const {
        participants,
        waitingRoom,
        transientRoles,
        toggleHandRaise,
        updateParticipant,
        muteParticipant,
        unmuteParticipant,
        muteAll,
        unmuteAll,
        makeHost,
        makeCoHost,
        revokeHost,
        revokeCoHost,
        removeParticipant,
        admitFromWaitingRoom,
        removeFromWaitingRoom,
        videoRestricted,
        setVideoRestriction,
        stopVideoAll,
        allowVideoAll,
        setVideoAllowed,
        forceSetParticipantVideo,
    } = useParticipantsStore();

    const [searchQuery, setSearchQuery] = useState('');

    const { user } = useAuthStore();
    const { meeting, isJoinedAsHost, updateMeetingSettings } = useMeetingStore();

    /** Current participant from store */
    const currentUserParticipant = participants.find(p => p.id === user?.id);
    const currentRole = (currentUserParticipant && (transientRoles[currentUserParticipant.id] || currentUserParticipant.role)) || 'participant';

    /** Resolve host status dynamically from state or participant list */
    const isHost = isJoinedAsHost || currentRole === 'host';

    const isCoHost = currentRole === 'co-host';
    const canControl = isHost || isCoHost;
    const canChangeRoles = isHost;
    const canSeeHandQueue = canControl || !!currentUserParticipant?.isHandRaised;
    // isOriginalHost: true if this user created the meeting.
    // Fallback: if originalHostId isn't set (old session), use isJoinedAsHost + hostId match.
    const isOriginalHost =
        (meeting?.originalHostId != null && meeting.originalHostId === user?.id) ||
        (isJoinedAsHost && meeting?.hostId === user?.id && !meeting?.originalHostId);

    const { setLocalStream, toggleAudio, toggleVideo } = useMeetingStore();

    const handleHandRaise = () => {
        const isSuspended = useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities;
        if (isSuspended && !canControl) {
            toast.error("Activities are suspended by host");
            return;
        }
        if (currentUserParticipant) toggleHandRaise(currentUserParticipant.id);
    };

    useEffect(() => {
        if (!socket) return;

        socket.on("frequent_question_users", (users: { participantId: string, name: string, count: number }[]) => {
            setFrequentQuestionUsers(users);
        });

        return () => {
            socket.off("frequent_question_users");
        };
    }, [socket, setFrequentQuestionUsers]);

    const handleAudioToggle = async () => {
        const isSuspended = useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities;
        if (isSuspended && !canControl) {
            toast.error("Activities are suspended by host");
            return;
        }
        const currentIsMuted = useMeetingStore.getState().isAudioMuted;
        const currentStream = useMeetingStore.getState().localStream;
        const hasEndedTrack = currentStream?.getAudioTracks().some(t => t.readyState === 'ended');

        if (currentIsMuted && (!currentStream || !currentStream.active || currentStream.getAudioTracks().length === 0 || hasEndedTrack)) {
            try {
                const isVideoOff = useMeetingStore.getState().isVideoOff;
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: !isVideoOff
                });
                setLocalStream(stream);
            } catch (err) {
                console.error("Failed to get audio stream:", err);
            }
        }
        toggleAudio();
        if (currentUserParticipant) {
            const nextMuted = !currentIsMuted;
            updateParticipant(currentUserParticipant.id, { isAudioMuted: nextMuted });

            // Broadcast update to others
            const { meetingId, emitParticipantUpdate } = useChatStore.getState();
            if (meetingId) {
                emitParticipantUpdate(meetingId, currentUserParticipant.id, { isAudioMuted: nextMuted });
            }
        }
    };

    const handleVideoToggle = async () => {
        const isSuspended = useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities;
        if (isSuspended && !canControl) {
            toast.error("Activities are suspended by host");
            return;
        }
        const currentIsVideoOff = useMeetingStore.getState().isVideoOff;
        const currentStream = useMeetingStore.getState().localStream;
        const hasEndedTrack = currentStream?.getVideoTracks().some(t => t.readyState === 'ended');

        if (currentIsVideoOff && (!currentStream || !currentStream.active || currentStream.getVideoTracks().length === 0 || hasEndedTrack)) {
            try {
                const isAudioMuted = useMeetingStore.getState().isAudioMuted;
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: !isAudioMuted
                });
                setLocalStream(stream);
            } catch (err) {
                console.error("Failed to get video stream:", err);
            }
        }
        toggleVideo();
        if (currentUserParticipant) {
            const nextVideoOff = !currentIsVideoOff;
            updateParticipant(currentUserParticipant.id, { isVideoOff: nextVideoOff });

            // Broadcast update to others
            const { meetingId, emitParticipantUpdate } = useChatStore.getState();
            if (meetingId) {
                emitParticipantUpdate(meetingId, currentUserParticipant.id, { isVideoOff: nextVideoOff });
            }
        }
    };

    /** SEARCH & SORT */
    const filteredParticipants = participants
        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (canSeeHandQueue) {
                // Put hand raised participants at the top
                if (a.isHandRaised && !b.isHandRaised) return -1;
                if (!a.isHandRaised && b.isHandRaised) return 1;

                // If both have hands raised, sort by number
                if (a.isHandRaised && b.isHandRaised) {
                    return (a.handRaiseNumber || 0) - (b.handRaiseNumber || 0);
                }
            }

            // Otherwise maintain original order or sort by name/role if desired
            return 0;
        });

    /** 🔑 MUTE-ALL STATE */
    const manageableParticipants = participants.filter(p => {
        const role = transientRoles[p.id] || p.role;
        return role === 'participant' || role === 'co-host';
    });
    const allMuted =
        manageableParticipants.length > 0 &&
        manageableParticipants.every(p => p.isAudioMuted === true);

    return (
        <>
            <AnimatePresence>
                {isParticipantsOpen && (
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
                        <div className="flex items-center justify-between p-4 border-b border-[#404040] flex-shrink-0">
                            <h3 className="text-lg font-semibold">
                                Participants ({participants.length})
                            </h3>
                            {/* Close button moved to TopBar */}
                        </div>

                        {/* SEARCH & HOST CONTROLS */}
                        <div className="p-4 border-b border-[#404040] flex flex-col gap-3 flex-shrink-0">

                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                                <div className="relative flex-[2.5] min-w-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search"
                                        className="pl-9 h-9 bg-[#232323] border-[#404040] text-sm"
                                    />
                                </div>

                                <div className="flex items-center gap-2 flex-none flex-wrap">
                                    {canControl && (
                                        <Button
                                            onClick={() => {
                                                if (confirm('Mute all participants?')) {
                                                    useChatStore.getState().muteAll(useMeetingStore.getState().meeting?.id || '');
                                                }
                                            }}
                                            variant="ghost"
                                            className="bg-[#2A2A2A] hover:bg-[#333] text-white border-none h-9 px-2 md:px-3 text-xs sm:text-sm"
                                        >
                                            <MicOff className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                                            Mute All
                                        </Button>
                                    )}

                                    {canControl && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="h-9 px-2 border-[#404040] hover:bg-[#2D2D2D] text-xs sm:text-sm"
                                                >
                                                    <MoreVertical className="w-4 h-4 mr-1" />
                                                    More
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="bg-[#1C1C1C] border-[#333] z-[100] text-gray-200" align="end">
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const settings = useMeetingStore.getState().meeting?.settings || {};
                                                        const isCameraAllowed = settings.cameraAllowed !== false;

                                                        if (isCameraAllowed) {
                                                            if (confirm('Stop all participant videos and restrict them?')) {
                                                                const meetingId = useMeetingStore.getState().meeting?.id || '';
                                                                useChatStore.getState().stopVideoAll(meetingId);
                                                                useMeetingStore.getState().updateMeetingSettings({ cameraAllowed: false });
                                                                setVideoRestriction(true);
                                                            }
                                                        } else {
                                                            if (confirm('Allow participants to start their video?')) {
                                                                useMeetingStore.getState().updateMeetingSettings({ cameraAllowed: true });
                                                                setVideoRestriction(false);
                                                            }
                                                        }
                                                    }}
                                                    className={cn("cursor-pointer flex items-center justify-between", !(useMeetingStore.getState().meeting?.settings?.cameraAllowed !== false) ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300" : "hover:bg-[#333]")}
                                                >
                                                    <div className="flex items-center">
                                                        {!(useMeetingStore.getState().meeting?.settings?.cameraAllowed !== false) ? <Video className="w-4 h-4 mr-2" /> : <VideoOff className="w-4 h-4 mr-2" />}
                                                        {!(useMeetingStore.getState().meeting?.settings?.cameraAllowed !== false) ? "Allow Participant Video" : "Disable All Video"}
                                                    </div>
                                                    {!(useMeetingStore.getState().meeting?.settings?.cameraAllowed !== false) && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 px-1.5 py-0.5 rounded">Restricted</span>}
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const isSuspended = useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities;
                                                        if (!isSuspended) {
                                                            if (confirm('Suspend all participant activities? This turns off video, audio, chat, and screen sharing.')) {
                                                                const meetingId = useMeetingStore.getState().meeting?.id || '';
                                                                useMeetingStore.getState().updateMeetingSettings({
                                                                    suspendParticipantActivities: true,
                                                                    micAllowed: false,
                                                                    cameraAllowed: false,
                                                                    screenShareAllowed: false,
                                                                    chatAllowed: false
                                                                });
                                                                setVideoRestriction(true);
                                                                toast.success("Participant activities suspended.");
                                                            }
                                                        } else {
                                                            if (confirm('Resume participant activities?')) {
                                                                useMeetingStore.getState().updateMeetingSettings({
                                                                    suspendParticipantActivities: false,
                                                                    micAllowed: true,
                                                                    cameraAllowed: true,
                                                                    screenShareAllowed: true,
                                                                    chatAllowed: true
                                                                });
                                                                setVideoRestriction(false);
                                                                toast.success("Participant activities resumed.");
                                                            }
                                                        }
                                                    }}
                                                    className={cn("cursor-pointer flex items-center justify-between", useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities ? "bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 hover:text-zinc-300" : "hover:bg-zinc-500/10 text-zinc-300")}
                                                >
                                                    <div className="flex items-center">
                                                        {useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities ? <Check className="w-4 h-4 mr-2 text-zinc-400" /> : <AlertCircle className="w-4 h-4 mr-2 text-zinc-400" />}
                                                        {useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities ? "Resume Activities" : "Suspend Activities"}
                                                    </div>
                                                    {useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-zinc-500/20 px-1.5 py-0.5 rounded">Suspended</span>}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        const currentLocked = useMeetingStore.getState().meeting?.settings?.isLocked;
                                                        useMeetingStore.getState().updateMeetingSettings({ isLocked: !currentLocked });
                                                        toast.success(!currentLocked ? "Meeting Locked. No new participants can join." : "Meeting Unlocked.");
                                                    }}
                                                    className="hover:bg-[#333] cursor-pointer"
                                                >
                                                    {useMeetingStore.getState().meeting?.settings?.isLocked ? <LockIcon className="w-4 h-4 mr-2 text-green-400" /> : <LockIcon className="w-4 h-4 mr-2 text-red-400" />}
                                                    {useMeetingStore.getState().meeting?.settings?.isLocked ? "Unlock Meeting" : "Lock Meeting"}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        const msg = window.prompt("Enter host broadcast message:");
                                                        if (msg?.trim()) {
                                                            const { meetingId, sendHostBroadcast } = useChatStore.getState();
                                                            if (meetingId) {
                                                                sendHostBroadcast(meetingId, msg.trim());
                                                            }
                                                            toast.success("Broadcast sent!");
                                                        }
                                                    }}
                                                    className="hover:bg-[#333] cursor-pointer"
                                                >
                                                    <MessageSquare className="w-4 h-4 mr-2" />
                                                    Broadcast Message
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* MAIN SCROLLABLE CONTENT */}
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4">
                            {/* WAITING ROOM */}
                            {waitingRoom.length > 0 && canControl && (
                                <div className="border-b border-[#404040]">
                                    <div className="p-4 bg-[#232323]">
                                        <h4 className="text-sm font-semibold mb-3">
                                            Waiting Room ({waitingRoom.length})
                                        </h4>
                                        <div className="space-y-2 pr-1 custom-scrollbar">
                                            {waitingRoom.map(person => (
                                                <div
                                                    key={person.id}
                                                    className="flex items-center justify-between"
                                                >
                                                    <span className="text-sm">{person.name}</span>
                                                    <div className="flex gap-4 items-center">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => useChatStore.getState().admitParticipant(useMeetingStore.getState().meeting?.id || '', person.socketId)}
                                                            className="bg-green-500 hover:bg-green-600 text-white font-bold h-8 px-4"
                                                        >
                                                            Admit
                                                        </Button>
                                                        <button
                                                            onClick={() => useChatStore.getState().denyParticipant(useMeetingStore.getState().meeting?.id || '', person.socketId)}
                                                            className="text-red-500 hover:text-red-400 text-sm font-bold transition-colors"
                                                        >
                                                            Deny
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* RAISED HANDS SUMMARY */}
                            {canSeeHandQueue && participants.filter(p => p.isHandRaised).length > 0 && (
                                <div className="mx-4 my-2 px-3 py-2 bg-[#2D2D2D]/80 border border-white/10 rounded-lg flex items-center gap-2 max-w-fit shadow-sm backdrop-blur-md">
                                    <Hand className="w-4 h-4 text-yellow-500" />
                                    <span className="text-xs font-medium text-white/90">
                                        Raised Hands ({participants.filter(p => p.isHandRaised).length})
                                    </span>
                                </div>
                            )}

                            {/* PARTICIPANTS LIST */}
                            {filteredParticipants.map(participant => {
                                const displayedRole = transientRoles[participant.id] || participant.role;
                                const coHostCount = participants.filter(p => (transientRoles[p.id] || p.role) === 'co-host').length;
                                const hostCount = participants.filter(p => (transientRoles[p.id] || p.role) === 'host').length;

                                const isCurrentUser =
                                    participant.id === user?.id ||
                                    participant.id === `participant-${user?.id}` ||
                                    participant.id === localUserId;

                                return (
                                    <ParticipantItem
                                        key={participant.id}
                                        participant={participant}
                                        isCurrentUser={isCurrentUser}
                                        canControl={canControl}
                                        canChangeRoles={canChangeRoles}
                                        isViewerOriginalHost={isOriginalHost}
                                        isViewerHost={isHost}
                                        isViewerCoHost={isCoHost}
                                        isTargetOriginalHost={participant.id === (meeting?.hostId || meeting?.originalHostId)}
                                        onToggleHand={() => toggleHandRaise(participant.id)}
                                        onTakeControl={() => {
                                            useChatStore.getState().requestControl(participant.id);
                                        }}
                                        onToggleMute={isCurrentUser ? handleAudioToggle : () => {
                                            if (!participant.isAudioMuted) {
                                                muteParticipant(participant.id);
                                            }
                                        }}
                                        onMakeHost={() => makeHost(participant.id)}
                                        onMakeCoHost={() => makeCoHost(participant.id)}
                                        onRemove={() => removeParticipant(participant.id)}
                                        onBan={() => {
                                            const mId = meeting?.id;
                                            if (mId) useChatStore.getState().banParticipant(mId, participant.id);
                                        }}
                                        onRevokeHost={() => revokeHost(participant.id)}
                                        onRevokeCoHost={() => revokeCoHost(participant.id)}
                                        onToggleVideoAllowed={() => {
                                            if (!participant.isVideoOff) {
                                                setVideoAllowed(participant.id, false);
                                            }
                                        }}
                                        onRequestMedia={(userId, type) => {
                                            if (meeting?.id) {
                                                useChatStore.getState().requestMedia(meeting.id, userId, type);
                                            }
                                        }}
                                        onToggleVideo={isCurrentUser ? handleVideoToggle : undefined}
                                        onRename={isCurrentUser && (canControl || meeting?.settings?.allowRename !== false) ? () => {
                                            const newPrompt = isCurrentUser ? "Enter new name:" : `Enter new name for ${participant.name}:`;
                                            const newName = window.prompt(newPrompt, participant.name);
                                            if (newName && newName.trim()) {
                                                updateParticipant(participant.id, { name: newName.trim() });
                                                if (meeting?.id) {
                                                    useChatStore.getState().emitParticipantUpdate(meeting.id, participant.id, { name: newName.trim() });
                                                }
                                            }
                                        } : undefined}
                                        onPin={() => {
                                            const { pinnedParticipantId, pinParticipant, unpinParticipant } = useParticipantsStore.getState();
                                            if (pinnedParticipantId === participant.id) unpinParticipant();
                                            else pinParticipant(participant.id);
                                        }}
                                        onSpotlight={() => {
                                            const { spotlightedParticipantId, spotlightParticipant, unspotlightParticipant } = useParticipantsStore.getState();
                                            if (spotlightedParticipantId === participant.id) unspotlightParticipant();
                                            else spotlightParticipant(participant.id);
                                        }}
                                        isPinned={participant.isPinned}
                                        isSpotlighted={participant.isSpotlighted}
                                        displayedRole={displayedRole}
                                        coHostCount={coHostCount}
                                        hostCount={hostCount}
                                        meeting={meeting}
                                        canSeeHandQueue={canSeeHandQueue}
                                    />
                                );
                            })}

                            {/* FREQUENT QUESTION ASKERS SECTION */}
                            {isHost && frequentQuestionUsers.length > 0 && (
                                <div className="mt-3 border-t border-gray-700 pt-2 px-4 pb-4">
                                    <div className="text-sm font-semibold text-yellow-400">
                                        Frequent Question Askers 🔥
                                    </div>

                                    {frequentQuestionUsers.map((fqUser) => (
                                        <div key={fqUser.participantId} className="flex justify-between text-sm mt-1">
                                            <span className="text-gray-200">{fqUser.name}</span>
                                            <span className="bg-yellow-500 text-black px-2 rounded text-xs">
                                                {fqUser.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>



                        {/* Participant Side: Remote Control Approval Dialog */}
                    </motion.div>
                )}
            </AnimatePresence>
            <ControlApprovalDialog />
        </>
    );
}

function ControlApprovalDialog() {
    const pendingRequest = useChatStore(state => state.pendingControlRequest);
    const respondToControl = useChatStore(state => state.respondToControl);
    const getAgentStatus = useChatStore(state => state.getAgentStatus);
    const checkAndLinkAgent = useChatStore(state => state.checkAndLinkAgent);
    const localUserId = useChatStore(state => state.localUserId);
    const meetingId = useChatStore(state => state.meetingId);
    const socket = useChatStore(state => state.socket);
    const { participants } = useParticipantsStore();

    const me = participants.find(p => p.id === localUserId);
    const agentConnected = me?.agentConnected || false;
    const hasAgent = me?.hasAgent || false;

    // Initial check when popup opens
    useEffect(() => {
        if (!pendingRequest || !meetingId || !localUserId) return;

        console.log('[AGENT] Popup opened, checking for existing agent (and polling)...');
        
        const tryLink = async () => {
            const success = await checkAndLinkAgent(meetingId, localUserId);
            if (success) {
                getAgentStatus(meetingId, localUserId);
            }
        };
        
        // Initial try
        tryLink();
        
        // Poll every 3 seconds as long as we are not connected
        const intervalId = setInterval(() => {
            const me = useParticipantsStore.getState().participants.find(p => p.id === localUserId);
            if (!me?.agentConnected) {
                tryLink();
            }
        }, 3000);

        return () => {
            clearInterval(intervalId);
        };
    }, [!!pendingRequest, meetingId, localUserId, socket]);

    if (!pendingRequest) return null;

    const handleInstallAgent = () => {
        toast.info("Downloading Agent...", {
            description: "The installer will start downloading shortly."
        });
        window.open(
            "https://drive.google.com/uc?export=download&id=1uMZuCf2NjYrPPfGfl9dJ0LjDniudBPS7"
        );

        if (meetingId && localUserId) {
            useChatStore.getState().install_agent_trigger(meetingId, localUserId);
        }
    };

    const handleAccept = () => {
        if (!agentConnected) {
            toast.error("Agent Not Ready", {
                description: "Please install and start the Remote Control Agent before accepting."
            });
            return;
        }

        respondToControl(true);

        // Transition to active state entirely from the first popup 
        useMeetingStore.getState().setRemoteControlState({
            status: 'active',
            role: 'controlled',
            targetId: pendingRequest.hostId,
            targetName: pendingRequest.hostName
        });

        // NATIVE ELECTRON CAPTURE REPLACES WRAPPER:
        // By skipping `start-remote-control-share`, we prevent the browser from prompting the user
        // "What to share". The Electron Agent will silently auto-capture instead.
    };

    return (
        <Dialog open={!!pendingRequest} onOpenChange={(open) => !open && respondToControl(false)}>
            <DialogContent className="bg-[#1A1A1A] text-white border-[#333] max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-blue-500" />
                        Remote Control Request
                    </DialogTitle>
                </DialogHeader>

                <div className="py-6 space-y-4">
                    <p className="text-gray-300">
                        <span className="font-bold text-white">{pendingRequest.hostName}</span> wants to take control of your system.
                    </p>

                    {!agentConnected && !hasAgent && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-yellow-500">Agent Not Running/Installed</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Please start or install the Remote Control Agent to allow the host to control your screen.
                                </p>
                            </div>
                        </div>
                    )}

                    {!agentConnected && hasAgent && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
                            <Bot className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-blue-500">Agent Not Connected</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    The agent is installed but not connected. Please open the "Replica Agent" app on your computer.
                                </p>
                            </div>
                        </div>
                    )}

                    {agentConnected && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
                            <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-green-500">Agent Ready</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    The host will be able to see your screen and control your mouse/keyboard.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => respondToControl(false)}
                        className="flex-1 hover:bg-white/5 border border-white/10 order-3 sm:order-1"
                    >
                        Reject
                    </Button>
                    <Button
                        onClick={handleInstallAgent}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 order-2"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Install Agent
                    </Button>
                    <Button
                        onClick={handleAccept}
                        className={cn(
                            "flex-1 font-bold order-1 sm:order-3",
                            agentConnected
                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                : "bg-blue-600/50 cursor-not-allowed text-white/50"
                        )}
                    >
                        Accept
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ParticipantItemProps {
    participant: Participant;
    isCurrentUser: boolean;
    canControl: boolean;
    canChangeRoles?: boolean;
    isViewerOriginalHost?: boolean;
    isViewerHost?: boolean;
    isViewerCoHost?: boolean;
    isTargetOriginalHost?: boolean;
    onToggleHand: () => void;
    onToggleMute: () => void;
    onMakeHost: () => void;
    onMakeCoHost: () => void;
    onRemove: () => void;
    onBan: () => void;
    onRevokeHost: () => void;
    onRevokeCoHost: () => void;
    onToggleVideoAllowed: () => void;
    onTakeControl: () => void;
    onRequestMedia: (userId: string, type: 'audio' | 'video') => void;
    onToggleVideo?: () => void;
    onRename?: () => void;
    onPin?: () => void;
    onSpotlight?: () => void;
    onChat?: () => void;
    isPinned?: boolean;
    isSpotlighted?: boolean;
    displayedRole?: Participant['role'];
    coHostCount: number;
    hostCount: number;
    meeting: Meeting | null;
    canSeeHandQueue?: boolean;
}

function ParticipantItem({
    participant,
    isCurrentUser,
    canControl,
    canChangeRoles = false,
    onToggleHand,
    onToggleMute,
    onMakeHost,
    onMakeCoHost,
    onRemove,
    onBan,
    onRevokeHost,
    onRevokeCoHost,
    onToggleVideoAllowed,
    onTakeControl,
    onRequestMedia,
    onToggleVideo,
    onRename,
    onPin,
    onSpotlight,
    onChat,
    isPinned = false,
    isSpotlighted = false,
    isViewerOriginalHost = false,
    isViewerHost = false,
    isViewerCoHost = false,
    isTargetOriginalHost = false,
    displayedRole = participant.role,
    coHostCount,
    hostCount,
    meeting,
    canSeeHandQueue = true,
}: ParticipantItemProps) {
    const effectiveRole = displayedRole || participant.role;
    const isSuspended = useMeetingStore(state => state.meeting?.settings?.suspendParticipantActivities);
    const isLocked = isSuspended && !canControl;

    const nativeAgentStatus = useChatStore(state => state.nativeAgentStatus);

    return (
        <div className="flex items-center justify-between p-4 hover:bg-[#232323]">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                    style={{ backgroundColor: participant.avatar }}
                >
                    {participant.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                            {participant.name} {isCurrentUser && '(You)'}
                        </span>
                        {effectiveRole === 'host' && (
                            <div className="flex items-center gap-1.5">
                                <span className="bg-[#3B82F6] text-white text-[10px] font-medium px-1.5 py-0.5 rounded tracking-wide">
                                    Host
                                </span>
                                <Crown className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]/10" />
                            </div>
                        )}
                        {effectiveRole === 'co-host' && (
                            <div className="flex items-center gap-1.5">
                                <span className="bg-purple-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded tracking-wide">
                                    Co-Host
                                </span>
                                <Shield className="w-4 h-4 text-purple-500" />
                            </div>
                        )}

                    </div>

                    <div className="flex items-center gap-2 mt-1">
                        <button
                            onClick={isCurrentUser ? onToggleMute : () => {
                                if (!participant.isAudioMuted) {
                                    onToggleMute();
                                } else if (canControl) {
                                    onRequestMedia(participant.id, 'audio');
                                }
                            }}
                            disabled={isLocked && isCurrentUser}
                            className={cn(
                                "p-2 -m-2 transition-all rounded-full active:scale-90",
                                isCurrentUser ? (isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-white/5") : (canControl ? "hover:bg-white/5" : "cursor-default backdrop-none")
                            )}
                        >
                            {participant.isAudioMuted ? (
                                <MicOff className="w-4 h-4 text-red-500" />
                            ) : (
                                <Mic className="w-4 h-4 text-green-500" />
                            )}
                        </button>
                        <button
                            onClick={isCurrentUser ? onToggleVideo : () => {
                                if (!participant.isVideoOff) {
                                    onToggleVideoAllowed();
                                } else if (canControl) {
                                    onRequestMedia(participant.id, 'video');
                                }
                            }}
                            disabled={isLocked && isCurrentUser}
                            className={cn(
                                "p-2 -m-2 transition-all rounded-full active:scale-90",
                                isCurrentUser ? (isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-white/5") : (canControl ? "hover:bg-white/5" : "cursor-default backdrop-none")
                            )}
                        >
                            {participant.isVideoOff ? (
                                <VideoOff className="w-4 h-4 text-red-500" />
                            ) : (
                                <Video className="w-4 h-4 text-green-500" />
                            )}
                        </button>
                        {participant.isHandRaised && canSeeHandQueue && (
                            <motion.div
                                initial={{ scale: 0, x: 10 }}
                                animate={{ scale: 1, x: 0 }}
                                className="flex items-center gap-1.5 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]"
                            >
                                <motion.div
                                    animate={{
                                        rotate: [0, -10, 10, -10, 0],
                                        scale: [1, 1.1, 1]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        repeatDelay: 3
                                    }}
                                >
                                    <Hand className="w-3.5 h-3.5 text-yellow-500" />
                                </motion.div>
                                {participant.handRaiseNumber && (
                                    <span className="text-[11px] font-bold text-yellow-500">
                                        #{participant.handRaiseNumber}
                                    </span>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {isCurrentUser && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onToggleHand}
                        disabled={isLocked}
                        className={cn(
                            'hover:bg-[#2D2D2D]',
                            participant.isHandRaised && 'text-yellow-500',
                            isLocked && 'cursor-not-allowed opacity-50'
                        )}
                    >
                        <Hand className="w-4 h-4" />
                    </Button>
                )}

                {(isCurrentUser || (!isTargetOriginalHost && (
                    (isViewerOriginalHost && isViewerHost && !isViewerCoHost) ||
                    (isViewerHost && !isViewerCoHost && effectiveRole !== 'host') ||
                    (isViewerCoHost && effectiveRole === 'participant')
                ))) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="hover:bg-[#2D2D2D]">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="bg-[#232323] border-[#404040]"
                            >
                                {isCurrentUser && onRename && (
                                    <DropdownMenuItem onClick={onRename}>
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        Rename
                                    </DropdownMenuItem>
                                )}

                                {onPin && (
                                    <DropdownMenuItem onClick={onPin}>
                                        <Pin className={cn("w-4 h-4 mr-2", isPinned && "text-blue-500 fill-blue-500/10")} />
                                        {isPinned ? 'Unpin Video' : 'Pin Video'}
                                    </DropdownMenuItem>
                                )}

                                {participant.isHandRaised && (canControl || isCurrentUser) && (
                                    <DropdownMenuItem onClick={onToggleHand}>
                                        <Hand className="w-4 h-4 mr-2 text-yellow-500" />
                                        Lower Hand
                                    </DropdownMenuItem>
                                )}

                                {(effectiveRole === 'participant' || (effectiveRole === 'co-host' && isViewerHost)) && !participant.isAudioMuted && !isCurrentUser && (
                                    <DropdownMenuItem onClick={onToggleMute}>
                                        <MicOff className="w-4 h-4 mr-2" />
                                        Mute
                                    </DropdownMenuItem>
                                )}

                                {(effectiveRole === 'participant' || (effectiveRole === 'co-host' && isViewerHost)) && participant.isAudioMuted && !isCurrentUser && (
                                    <DropdownMenuItem onClick={() => onRequestMedia(participant.id, 'audio')}>
                                        <Mic className="w-4 h-4 mr-2" />
                                        Ask to Unmute
                                    </DropdownMenuItem>
                                )}

                                {canControl && (effectiveRole === 'participant' || (effectiveRole === 'co-host' && isViewerHost)) && !participant.isVideoOff && !isCurrentUser && (
                                    <DropdownMenuItem onClick={onToggleVideoAllowed}>
                                        <VideoOff className="w-4 h-4 mr-2 text-red-500" />
                                        Turn Off Camera
                                    </DropdownMenuItem>
                                )}

                                {canControl && (effectiveRole === 'participant' || (effectiveRole === 'co-host' && isViewerHost)) && !isCurrentUser && (
                                    <>
                                        <DropdownMenuItem onClick={() => {
                                            useChatStore.getState().requestControl(participant.id);
                                        }}>
                                            <Monitor className={cn("w-4 h-4 mr-2", !(participant.hasAgent || participant.agentConnected) && "text-yellow-500")} />
                                            Take Control
                                        </DropdownMenuItem>
                                    </>
                                )}

                                {canControl && (effectiveRole === 'participant' || (effectiveRole === 'co-host' && isViewerHost)) && participant.isVideoOff && !isCurrentUser && (
                                    <DropdownMenuItem onClick={() => onRequestMedia(participant.id, 'video')}>
                                        <Video className="w-4 h-4 mr-2" />
                                        Ask to Start Video
                                    </DropdownMenuItem>
                                )}

                                {isViewerHost && !isViewerCoHost && (
                                    <>
                                        {effectiveRole !== 'host' && (
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    if (confirm('Promote this participant as a Host?')) {
                                                        onMakeHost();
                                                    }
                                                }}
                                            >
                                                <Crown className="w-4 h-4 mr-2" />
                                                Make Host
                                            </DropdownMenuItem>
                                        )}

                                        {/* Remove Host - only Main Host can demote promoted hosts */}
                                        {isViewerOriginalHost && isViewerHost && !isViewerCoHost && effectiveRole === 'host' && !isTargetOriginalHost && (
                                            <DropdownMenuItem
                                                onClick={onRevokeHost}
                                                className="text-yellow-400"
                                            >
                                                <Crown className="w-4 h-4 mr-2" />
                                                Remove Host
                                            </DropdownMenuItem>
                                        )}

                                        {effectiveRole !== 'co-host' && effectiveRole !== 'host' && (
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    if (coHostCount >= 4) {
                                                        alert('Maximum co-hosts reached.');
                                                        return;
                                                    }
                                                    onMakeCoHost();
                                                }}
                                            >
                                                <Shield className="w-4 h-4 mr-2" />
                                                Make Co-Host
                                            </DropdownMenuItem>
                                        )}

                                        {effectiveRole === 'co-host' && !isCurrentUser && (
                                            <DropdownMenuItem
                                                onClick={onRevokeCoHost}
                                                className="text-yellow-400"
                                            >
                                                <Shield className="w-4 h-4 mr-2" />
                                                Remove Co-Host
                                            </DropdownMenuItem>
                                        )}
                                    </>
                                )}

                                {(canControl || isViewerOriginalHost) && !isCurrentUser && !isTargetOriginalHost && (
                                    <>
                                        <DropdownMenuItem
                                            onClick={onRemove}
                                            className="text-red-500"
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Remove
                                        </DropdownMenuItem>
                                    </>
                                )}

                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
            </div>



        </div>
    );
}

/* ---------------- AI COMPANION PANEL ---------------- */

interface AIMessage {
    id: string;
    sender: 'user' | 'ai';
    content: string;
    timestamp: Date;
    isThinking?: boolean;
}

const MOCK_INSIGHTS = [
    "Listening for meeting highlights...",
    "Summary updates every 30 seconds.",
    "Ask me to create a meeting recap!",
    "I can suggest action items from chat."
];

export function AICompanionPanel() {
    const { isAICompanionOpen, toggleAICompanion, meeting } = useMeetingStore();
    const {
        summaryPoints, setSummaryPoints,
        actionItems, toggleActionItem, addActionItem, setActionItems,
        aiMessages, addAiMessage,
        isGeneratingSummary, setIsGeneratingSummary,
        isSuggestingActions, setIsSuggestingActions
    } = useAIStore();
    const { messages: chatMessages } = useChatStore();

    const [activeTab, setActiveTab] = useState('chat');

    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    /* ---------------- STATE: UI ---------------- */
    const [newItemText, setNewItemText] = useState('');
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    /* ---------------- EFFECTS: MOCK LIVE UPDATES ---------------- */

    // Simulate Live Summary Updates
    useEffect(() => {
        if (!isAICompanionOpen) return;

        // Initial summary fetch when panel opens
        if (summaryPoints.length === 0 && !isGeneratingSummary) {
            handleRefreshSummary();
        }

        // Periodically refresh summary
        const interval = setInterval(() => {
            handleRefreshSummary();
        }, 30000); // Refresh every 30 seconds

        return () => clearInterval(interval);
    }, [isAICompanionOpen, isGeneratingSummary, summaryPoints.length]);

    // Simulate Insights Ticker
    const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
    useEffect(() => {
        if (!isAICompanionOpen) return;

        const interval = setInterval(() => {
            setCurrentInsightIndex(prev => (prev + 1) % MOCK_INSIGHTS.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [isAICompanionOpen]);

    /* ---------------- LOGIC: CHAT ---------------- */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages, isTyping, activeTab]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: AIMessage = {
            id: Date.now().toString(),
            sender: 'user',
            content: input,
            timestamp: new Date(),
        };

        addAiMessage(userMsg);
        setInput('');
        setIsTyping(true);

        try {
            // Prepare messages context for Groq
            // We include the last few messages for context
            const contextMessages = aiMessages.slice(-5).map(m => ({
                role: m.sender === 'ai' ? 'assistant' : 'user',
                content: m.content
            }));
            contextMessages.push({ role: 'user', content: userMsg.content });

            const response = await fetch(`${API}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: contextMessages,
                    meetingId: meeting?.id,
                    userName: useAuthStore.getState().user?.name || 'Participant'
                }),
            });

            if (!response.ok) throw new Error('AI response failed');

            const data = await response.json();

            const aiMsg: AIMessage = {
                id: Date.now().toString(),
                sender: 'ai',
                content: data.content,
                timestamp: new Date(),
            };
            addAiMessage(aiMsg);
        } catch (err) {
            console.error('AI Error:', err);
            const errorMsg: AIMessage = {
                id: Date.now().toString(),
                sender: 'ai',
                content: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later.",
                timestamp: new Date(),
            };
            addAiMessage(errorMsg);
        } finally {
            setIsTyping(false);
        }
    };

    const handleQuickAction = async (action: string) => {
        setIsTyping(true);
        try {
            let prompt = "";
            let contextTranscript = "";

            const spokenTranscriptsList = useTranscriptionStore.getState().transcripts;

            if (action === "Summarize last 5 minutes") {
                const recentChat = chatMessages
                    .slice(-15) // Last 15 messages ~5 mins
                    .map(m => `${m.senderName}: ${m.content}`)
                    .join('\n');
                // Approx last 5 mins of speech
                const recentSpeech = spokenTranscriptsList
                    .slice(-30)
                    .map(t => `${t.participantName}: ${t.text}`)
                    .join('\n');

                contextTranscript = `--- SPOKEN TRANSCRIPT ---\n${recentSpeech}\n\n--- CHAT TRANSCRIPT ---\n${recentChat}`;
                prompt = `Provide a detailed summary of the conversation that happened in the last 5 minutes. Focus on the specific details of this recent segment. Use both spoken transcription and chat messages. \n\nIMPORTANT INSTRUCTIONS:\n1. Start your response EXACTLY with: \"Here is a summary of the conversation that occurred in the last 5 minutes:\"\n2. NEVER mention if chat messages or spoken transcripts are missing or empty. \n3. DO NOT use phrases like \"There are no chat messages to incorporate\" or \"No chat messages in the provided data\".\n4. Simply provide the summary based ONLY on whatever text data is provided without any metacommentary.\n\nData: \n\n${contextTranscript}`;
            } else if (action === "Create meeting recap") {
                const allChat = chatMessages
                    .map(m => `${m.senderName}: ${m.content}`)
                    .join('\n');
                const allSpeech = spokenTranscriptsList
                    .map(t => `${t.participantName}: ${t.text}`)
                    .join('\n');

                contextTranscript = `--- SPOKEN TRANSCRIPT ---\n${allSpeech}\n\n--- CHAT TRANSCRIPT ---\n${allChat}`;
                prompt = `Provide a high-level executive recap of the entire meeting so far based on spoken transcription and chat messages. Highlight the main objectives, key outcomes, and overall progress. \n\nIMPORTANT INSTRUCTIONS:\n1. NEVER mention if chat messages or spoken transcripts are missing or empty.\n2. DO NOT use phrases like \"There are no chat messages to incorporate\" or \"No chat messages in the provided data\".\n3. Simply generate the recap using whatever data is provided without any metacommentary about the data sources.\n\nData: \n\n${contextTranscript}`;
            } else if (action === "Draft follow-up email") {
                const allChat = chatMessages
                    .map(m => `${m.senderName}: ${m.content}`)
                    .join('\n');
                const allSpeech = spokenTranscriptsList
                    .map(t => `${t.participantName}: ${t.text}`)
                    .join('\n');

                const userName = useAuthStore.getState().user?.name || "Participant";

                contextTranscript = `--- SPOKEN TRANSCRIPT ---\n${allSpeech}\n\n--- CHAT TRANSCRIPT ---\n${allChat}`;
                prompt = `Based on the meeting data (spoken transcription and chat messages), draft a professional follow-up email. Include a thank you note, a summary of what was discussed, and a clear list of next steps. \n\nIMPORTANT: \n1. DO NOT mention if chat messages or spoken transcripts are missing or empty. Just draft the email using whatever data is provided without any metacommentary about the data sources.\n2. SIGN OFF the email with "Best Regards, ${userName}". DO NOT use [Your Name] or any other placeholder.\n\nData: \n\n${contextTranscript}`;
            } else {
                // Default fallback
                setInput(action);
                setIsTyping(false);
                return;
            }

            const response = await fetch(`${API}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    meetingId: meeting?.id,
                    userName: useAuthStore.getState().user?.name || 'Participant'
                }),
            });

            if (!response.ok) throw new Error('AI action failed');
            const data = await response.json();

            const aiMsg: AIMessage = {
                id: Date.now().toString(),
                sender: 'ai',
                content: data.content,
                timestamp: new Date(),
            };
            addAiMessage(aiMsg);
        } catch (err) {
            console.error('AI Quick Action Error:', err);
            toast.error("Failed to process quick action.");
        } finally {
            setIsTyping(false);
            setInput('');
        }
    };

    /* ---------------- LOGIC: ACTION ITEMS ---------------- */
    const handleAddActionItem = () => {
        if (!newItemText.trim()) return;
        addActionItem(newItemText);
        setNewItemText('');
    };

    const handleSuggestActions = async () => {
        if (isSuggestingActions) return;

        const spokenTranscript = useTranscriptionStore.getState().transcripts.map(t => `${t.participantName}: ${t.text}`).join('\n');
        const chatTranscript = chatMessages.map(m => `${m.senderName}: ${m.content}`).join('\n');
        const fullTranscript = `--- SPOKEN TRANSCRIPT ---\n${spokenTranscript}\n\n--- CHAT TRANSCRIPT ---\n${chatTranscript}`;

        if (!spokenTranscript.trim() && !chatTranscript.trim()) {
            toast.error("Transcript is empty. Talk or chat a bit before suggesting actions.");
            return;
        }

        setIsSuggestingActions(true);

        try {
            const prompt = `Based on this meeting transcript (both spoken and chat), identify specific actionable tasks OR suggest logical next steps based on the discussion topics. Aim to provide practical items even if not explicitly stated as todos. Return ONLY a JSON array of strings, e.g. ["Research X", "Set up follow-up", "Update document"]. Transcript: \n\n${fullTranscript}`;

            const response = await fetch(`${API}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    meetingId: meeting?.id
                }),
            });

            if (!response.ok) throw new Error('Action suggestion failed');

            const data = await response.json();
            try {
                // Try to find the JSON array in the response (sometimes AI wraps it in markdown)
                const match = data.content.match(/\[.*\]/s);
                const suggestedTasks = match ? JSON.parse(match[0]) : [];

                if (suggestedTasks.length > 0) {
                    // Only add tasks that don't already exist in the list
                    const uniqueNewTasks = suggestedTasks.filter((t: string) =>
                        !actionItems.some(existing => existing.text.toLowerCase() === t.toLowerCase())
                    );

                    const newItems = uniqueNewTasks.map((t: string) => ({
                        id: Date.now().toString() + Math.random(),
                        text: t,
                        completed: false
                    }));
                    setActionItems([...actionItems, ...newItems]);
                }
            } catch (pErr) {
                console.error('Failed to parse suggested actions:', pErr);
                toast.error("Failed to parse AI suggestions.");
            }
        } catch (err) {
            console.error('AI Suggestion Error:', err);
            toast.error("AI service is currently unavailable.");
        } finally {
            setIsSuggestingActions(false);
        }
    };

    /* ---------------- LOGIC: SUMMARY ---------------- */
    const handleRefreshSummary = async () => {
        if (isGeneratingSummary) return;
        setIsGeneratingSummary(true);

        try {
            const spokenTranscript = useTranscriptionStore.getState().transcripts.map(t => `${t.participantName}: ${t.text}`).join('\n');
            const chatTranscript = chatMessages.map(m => `${m.senderName}: ${m.content}`).join('\n');
            const fullTranscript = `--- SPOKEN TRANSCRIPT ---\n${spokenTranscript}\n\n--- CHAT TRANSCRIPT ---\n${chatTranscript}`;

            const prompt = `Provide a bulleted list of key summary points for this meeting so far based on the following spoken and chat transcripts. Return ONLY the bullet points, one per line, starting with "• ". Transcript: \n\n${fullTranscript}`;

            const response = await fetch(`${API}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    meetingId: meeting?.id
                }),
            });

            if (!response.ok) throw new Error('Summary generation failed');

            const data = await response.json();
            const points = data.content
                .split('\n')
                .map((line: string) => line.replace(/^[•\-\*]\s*/, '').trim())
                .filter((line: string) => line.length > 0);

            setSummaryPoints(points);
        } catch (err) {
            console.error('AI Summary Error:', err);
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const handleCopySummary = async () => {
        const fullSummary = summaryPoints.map(p => `• ${p}`).join('\n');
        try {
            await navigator.clipboard.writeText(fullSummary);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        } catch (err) {
            console.error('Failed to copy summary:', err);
        }
    };

    const handleDownloadSummary = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPos = 20;

        const meetingTitle = meeting?.title || "Untitled Meeting";
        const meetingId = meeting?.id || "N/A";

        // Find Host Name
        const allParticipants = useParticipantsStore.getState().participants;
        const hostParticipant = allParticipants.find(p => p.id === meeting?.hostId);
        const hostName = hostParticipant?.name || "N/A";

        // Branding
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Generated by NeuralChat AI Companion", margin, yPos);
        yPos += 10;

        // Header Rect
        doc.setFillColor(248, 250, 252);
        doc.rect(margin - 5, yPos - 5, pageWidth - (margin * 2) + 10, 45, 'F');

        // Title
        doc.setFontSize(22);
        doc.setTextColor(11, 92, 255); // Blue
        doc.setFont("helvetica", "bold");
        doc.text("Meeting Summary", margin, yPos + 10);
        yPos += 22;

        // Specific Meeting Info
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        const splitTitle = doc.splitTextToSize(meetingTitle, pageWidth - (margin * 2));
        doc.text(splitTitle, margin, yPos);
        yPos += (splitTitle.length * 8) + 4;

        // Metadata Grid
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");

        doc.text(`Meeting ID: ${meetingId}`, margin, yPos);
        doc.text(`Host: ${hostName}`, margin + 80, yPos);
        yPos += 6;

        const now = new Date();
        doc.text(`Export Date: ${now.toLocaleDateString()} | ${now.toLocaleTimeString()}`, margin, yPos);
        yPos += 20;

        // Summary Section Header
        doc.setFontSize(14);
        doc.setTextColor(11, 92, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Meeting Highlights", margin, yPos);
        yPos += 10;

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

        // Content
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "normal");

        if (summaryPoints.length === 0) {
            doc.text("No summary points generated yet.", margin, yPos);
        } else {
            summaryPoints.forEach(point => {
                const lines = doc.splitTextToSize(`• ${point}`, pageWidth - (margin * 2));
                doc.text(lines, margin, yPos);
                yPos += (lines.length * 7) + 2;

                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                    doc.setFontSize(11);
                    doc.setTextColor(51, 65, 85);
                }
            });
        }

        doc.save(`${meetingTitle.replace(/\s+/g, '_').toLowerCase()}_summary.pdf`);
    };


    return (
        <AnimatePresence>
            {isAICompanionOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="
            fixed top-0 right-0 bottom-0
            w-full sm:w-[380px]
            bg-[#1C1C1C]
            border-l border-[#404040]
            z-30
            flex flex-col
            shadow-2xl
            pb-[80px]
          "
                >
                    {/* HEADER */}
                    <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#404040] bg-[#232323]">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-400 fill-blue-400/20" />
                            <h3 className="text-lg font-semibold text-white">AI Companion</h3>
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        <div className="px-4 pt-2 bg-[#1C1C1C]">
                            <TabsList className="w-full bg-[#2A2A2A] border border-[#333]">
                                <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-[#333] data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none transition-all">
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Chat
                                </TabsTrigger>
                                <TabsTrigger value="summary" className="flex-1 data-[state=active]:bg-[#333] data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none transition-all">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Summary
                                </TabsTrigger>
                                <TabsTrigger value="actions" className="flex-1 data-[state=active]:bg-[#333] data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none transition-all">
                                    <ListTodo className="w-4 h-4 mr-2" />
                                    Actions
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* --- TAB: CHAT --- */}
                        {activeTab === 'chat' && (
                            <TabsContent value="chat" forceMount className="flex-1 flex flex-col min-h-0 mt-0">
                                {/* Chat Insights Ticker - Auto Scroll Mock */}
                                <div className="bg-blue-950/20 border-b border-blue-500/10 py-1.5 px-4 flex items-center gap-2 overflow-hidden h-8 shrink-0">
                                    <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
                                    <AnimatePresence mode='wait'>
                                        <motion.span
                                            key={currentInsightIndex}
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: -20, opacity: 0 }}
                                            className="text-xs text-blue-200 truncate font-medium"
                                        >
                                            {MOCK_INSIGHTS[currentInsightIndex]}
                                        </motion.span>
                                    </AnimatePresence>
                                </div>
                                {/* Message List */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                                    {aiMessages.map(msg => {
                                        const isAi = msg.sender === 'ai';
                                        return (
                                            <div key={msg.id} className={cn('flex flex-col gap-1.5', isAi ? 'items-start' : 'items-end')}>
                                                <div className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5 font-semibold px-1">
                                                    {isAi ? (
                                                        <>
                                                            <Sparkles className="w-3 h-3 text-blue-400" />
                                                            <span>AI Companion</span>
                                                        </>
                                                    ) : <span>You</span>}
                                                    <span className="font-normal opacity-50">• {(() => {
                                                        const d = new Date(msg.timestamp);
                                                        const h = String(d.getHours()).padStart(2, '0');
                                                        const m = String(d.getMinutes()).padStart(2, '0');
                                                        return `${h}:${m}`;
                                                    })()}</span>
                                                </div>
                                                <div className={cn(
                                                    "px-4 py-2.5 rounded-2xl text-sm max-w-[90%] md:max-w-[85%] relative group shadow-sm",
                                                    isAi
                                                        ? "bg-[#2A2A2A] text-gray-100 rounded-tl-none border border-[#333]"
                                                        : "bg-[#0B5CFF] text-white rounded-tr-none"
                                                )}>
                                                    {isAi ? (
                                                        <div className="prose prose-invert prose-sm max-w-none ai-content-markdown">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    ) : (
                                                        msg.content
                                                    )}
                                                    {isAi && (
                                                        <div className="absolute -bottom-7 left-0 hidden group-hover:flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-gray-500 hover:text-white hover:bg-transparent"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(msg.content);
                                                                    setCopiedMessageId(msg.id);
                                                                    setTimeout(() => setCopiedMessageId(null), 2000);
                                                                }}
                                                            >
                                                                {copiedMessageId === msg.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white hover:bg-transparent">
                                                                <ThumbsUp className="w-3 h-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white hover:bg-transparent">
                                                                <ThumbsDown className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {isTyping && (
                                        <div className="flex flex-col gap-1.5 items-start">
                                            <div className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5 font-semibold px-1">
                                                <Sparkles className="w-3 h-3 text-blue-400" />
                                                <span>Thinking...</span>
                                            </div>
                                            <div className="bg-[#2A2A2A] px-4 py-3 rounded-2xl rounded-tl-none border border-[#333] flex gap-1 items-center h-[40px]">
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Quick Actions */}
                                <div className="shrink-0 px-4 pb-3">
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                                        <button onClick={() => handleQuickAction("Create meeting recap")} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-xs text-blue-300 transition-colors flex items-center gap-1.5 shadow-sm">
                                            <Sparkles className="w-3 h-3" /> Meeting Recap
                                        </button>
                                        <button onClick={() => handleQuickAction("Summarize last 5 minutes")} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#2A2A2A] border border-[#333] hover:bg-[#333] text-xs text-gray-300 shadow-sm transition-colors">
                                            Last 5 Minutes
                                        </button>
                                        <button onClick={() => handleQuickAction("Draft follow-up email")} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[#2A2A2A] border border-[#333] hover:bg-[#333] text-xs text-gray-300 shadow-sm transition-colors">
                                            Draft Email
                                        </button>
                                    </div>
                                </div>

                                {/* Input */}
                                <div className="shrink-0 bg-[#1C1C1C] p-4 pt-2 border-t border-[#333]">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSend();
                                        }}
                                        className="flex items-center gap-2 bg-[#232323] border border-[#404040] rounded-xl px-3 py-2 transition-all focus-within:ring-1 focus-within:ring-blue-500/50"
                                    >
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Ask AI Companion..."
                                            className="flex-1 bg-transparent border-none text-white focus-visible:ring-0 placeholder:text-gray-500"
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            disabled={!input.trim() || isTyping}
                                            className={cn("transition-all duration-200", input.trim() ? 'bg-[#0B5CFF] hover:bg-blue-600' : 'bg-[#333] text-gray-400', 'text-white rounded-lg w-8 h-8')}
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </form>
                                </div>
                            </TabsContent>
                        )}

                        {/* --- TAB: SUMMARY --- */}
                        {activeTab === 'summary' && (
                            <TabsContent value="summary" forceMount className="flex-1 flex flex-col min-h-0 mt-0 overflow-y-auto p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-300">Live Meeting Summary</h4>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRefreshSummary}
                                        disabled={isGeneratingSummary}
                                        className="text-xs h-7 border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                                    >
                                        <Sparkles className={cn("w-3 h-3 mr-1", isGeneratingSummary && "animate-spin")} />
                                        {isGeneratingSummary ? 'Analyzing...' : 'Refresh'}
                                    </Button>
                                </div>

                                <div className="bg-[#232323] border border-[#333] rounded-lg p-4 space-y-3">
                                    {summaryPoints.length > 0 ? (
                                        summaryPoints.map((point, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="flex gap-2 items-start"
                                            >
                                                <span className="text-blue-500 mt-1.5 text-[10px]">•</span>
                                                <p className="text-sm text-gray-300 leading-relaxed">{point}</p>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center text-gray-500 space-y-2">
                                            <FileText className="w-8 h-8 mx-auto opacity-20" />
                                            <p className="text-xs italic">No summary points generated yet.<br />Type in chat and click Refresh.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleCopySummary}
                                        disabled={summaryPoints.length === 0}
                                        className={cn(
                                            "flex-1 transition-all duration-200 gap-2 text-white",
                                            copiedSummary ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
                                        )}
                                    >
                                        {copiedSummary ? (
                                            <>
                                                <Check className="w-4 h-4" /> Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" /> Copy Summary
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={handleDownloadSummary}
                                        disabled={summaryPoints.length === 0}
                                        variant="outline"
                                        className="border-[#404040] text-gray-300 hover:bg-[#333] hover:text-white transition-all duration-200 px-3"
                                        title="Download PDF"
                                    >
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TabsContent>
                        )}

                        {/* --- TAB: ACTION ITEMS --- */}
                        {activeTab === 'actions' && (
                            <TabsContent value="actions" forceMount className="flex-1 flex flex-col min-h-0 mt-0 overflow-y-auto p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-semibold text-gray-300">Action Items</h4>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSuggestActions}
                                        disabled={isSuggestingActions}
                                        className="text-xs h-7 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"
                                    >
                                        <Sparkles className={cn("w-3 h-3 mr-1", isSuggestingActions && "animate-spin")} />
                                        {isSuggestingActions ? 'Suggesting...' : 'Suggest'}
                                    </Button>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <AnimatePresence>
                                        {actionItems.length > 0 ? (
                                            actionItems.map(item => (
                                                <motion.div
                                                    key={item.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={cn(
                                                        "flex items-start gap-3 p-3 rounded-lg border transition-colors group",
                                                        item.completed
                                                            ? "bg-[#1A1A1A] border-[#333]"
                                                            : "bg-[#232323] border-[#404040] hover:border-blue-500/30"
                                                    )}
                                                >
                                                    <button
                                                        onClick={() => toggleActionItem(item.id)}
                                                        className={cn(
                                                            "mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all duration-200",
                                                            item.completed
                                                                ? "bg-blue-600 border-blue-600 text-white"
                                                                : "border-gray-500 text-transparent hover:border-blue-400"
                                                        )}
                                                    >
                                                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                    </button>
                                                    <span className={cn(
                                                        "text-sm leading-relaxed flex-1 transition-colors",
                                                        item.completed ? "text-gray-500 line-through" : "text-gray-200"
                                                    )}>
                                                        {item.text}
                                                    </span>
                                                </motion.div>
                                            ))
                                        ) : (
                                            <div className="py-12 text-center text-gray-500 space-y-2">
                                                <ListTodo className="w-8 h-8 mx-auto opacity-20" />
                                                <p className="text-xs italic">No action items yet.<br />Ask AI to suggest some!</p>
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="mt-auto pt-4 border-t border-[#333]">
                                    <div className="flex gap-2">
                                        <Input
                                            value={newItemText}
                                            onChange={(e) => setNewItemText(e.target.value)}
                                            placeholder="Add task..."
                                            className="flex-1 bg-[#232323] border-[#404040] text-white h-9 text-sm focus-visible:ring-1 focus-visible:ring-blue-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddActionItem()}
                                        />
                                        <Button size="sm" onClick={handleAddActionItem} disabled={!newItemText.trim()} className="bg-[#333] hover:bg-blue-600 text-white">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        )}

                    </Tabs>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* -------------------------------------------------------------------------------------------------
 * TRANSCRIPT PANEL
 * ------------------------------------------------------------------------------------------------- */

export function TranscriptPanel() {
    const { isTranscriptOpen, setTranscriptOpen, transcripts } = useTranscriptionStore();
    const [searchQuery, setSearchQuery] = useState('');
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Auto scroll to bottom when new transcripts arrive (only if not searching)
    useEffect(() => {
        if (isTranscriptOpen && !searchQuery) {
            transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcripts, isTranscriptOpen, searchQuery]);

    const filteredTranscripts = transcripts.filter(t =>
        t.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.participantName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownloadTranscript = () => {
        if (transcripts.length === 0) return;
        const textToSave = transcripts.map(t => {
            const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `[${time}] ${t.participantName}: ${t.text}`;
        }).join('\n\n');

        const blob = new Blob([textToSave], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Meeting_Transcript_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <AnimatePresence>
            {isTranscriptOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="
            fixed right-0 top-0 bottom-20
            w-full md:w-80 lg:w-96
            bg-[#1C1C1C]
            border-l border-[#404040]
            rounded-none
            z-30 flex flex-col min-h-0 overflow-hidden
            shadow-2xl
          "
                >
                    {/* HEADER */}
                    <div className="flex items-center justify-between p-4 border-b border-[#404040] flex-shrink-0">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-400" />
                            Live Transcript
                        </h3>
                    </div>

                    {/* SEARCH & ACTIONS */}
                    <div className="p-4 border-b border-[#404040] flex flex-col gap-3 flex-shrink-0 bg-[#232323]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search transcript..."
                                className="pl-9 h-9 bg-[#1A1A1A] border-[#404040] text-sm text-white focus-visible:ring-1 focus-visible:ring-blue-500 rounded-lg"
                            />
                        </div>
                        <Button
                            onClick={handleDownloadTranscript}
                            disabled={transcripts.length === 0}
                            className="w-full bg-[#333] hover:bg-[#444] text-white border-none h-9 flex items-center justify-center gap-2 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Save Transcript
                        </Button>
                    </div>

                    {/* TRANSCRIPT LIST */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 font-mono custom-scrollbar">
                        {filteredTranscripts.length > 0 ? (
                            filteredTranscripts.map((t, idx) => (
                                <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#252525] border border-[#333] hover:border-[#444] transition-colors group">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-blue-400">{t.participantName}</span>
                                        <span className="text-[10px] text-gray-500">
                                            {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                                        {t.text}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
                                <MessageSquare className="w-10 h-10 text-gray-500" />
                                <div>
                                    <p className="text-sm text-white font-medium">No transcripts found</p>
                                    <p className="text-xs text-gray-400 mt-1">{searchQuery ? "Try a different search term" : "Meeting captions will appear here"}</p>
                                </div>
                            </div>
                        )}
                        <div ref={transcriptEndRef} />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* -------------------------------------------------------------------------------------------------
 * RESOURCE HUB PANEL
 * ------------------------------------------------------------------------------------------------- */

export function ResourceHubPanel() {
    const { isHubOpen, setHubOpen, resources, shareResource, deleteResource, fetchResources } = useResourceStore();
    const { meeting } = useMeetingStore();
    const { user: currentUser } = useAuthStore();

    const [activeTab, setActiveTab] = useState<'all' | 'files' | 'links'>('all');
    const [isSharing, setIsSharing] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [shareType, setShareType] = useState<'link' | 'file'>('link');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [resourceToDelete, setResourceToDelete] = useState<{ id: number; meetingId: string } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setNewTitle(file.name);
            setNewContent(`File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        }
    };

    useEffect(() => {
        if (isHubOpen && meeting?.id) {
            fetchResources(meeting.id);
        }
    }, [isHubOpen, meeting?.id, fetchResources]);

    const handleShare = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            toast.error("Please fill in all fields");
            return;
        }

        if (meeting?.id && currentUser) {
            let metadata: any = {};

            if (shareType === 'file' && selectedFile) {
                try {
                    const reader = new FileReader();
                    const fileData = await new Promise<string>((resolve, reject) => {
                        reader.onload = (e) => resolve(e.target?.result as string);
                        reader.onerror = (e) => reject(e);
                        reader.readAsDataURL(selectedFile);
                    });

                    metadata = {
                        fileName: selectedFile.name,
                        fileSize: selectedFile.size,
                        fileType: selectedFile.type,
                        lastModified: selectedFile.lastModified,
                        fileData: fileData
                    };
                } catch (err) {
                    console.error("Error reading file:", err);
                    toast.error("Failed to read file");
                    return;
                }
            }

            shareResource(
                meeting.id,
                currentUser.id,
                currentUser.name,
                shareType,
                newTitle.trim(),
                newContent.trim(),
                metadata
            );
            setNewTitle('');
            setNewContent('');
            setSelectedFile(null);
            setIsSharing(false);
            toast.success("Resource shared!");
        }
    };

    const filteredResources = resources.filter(r => {
        if (activeTab === 'all') return true;
        if (activeTab === 'files') return r.type === 'file';
        if (activeTab === 'links') return r.type === 'link';
        return true;
    });

    return (
        <AnimatePresence>
            {isHubOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="
            fixed right-0 top-0 bottom-20
            w-full md:w-80 lg:w-96
            bg-[#1C1C1C]
            border-l border-[#404040]
            z-50 flex flex-col shadow-2xl
          "
                >
                    <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#404040]">
                        <div className="flex items-center gap-2">
                            <Plus className="w-5 h-5 text-blue-400" />
                            <h3 className="text-lg font-semibold">Resource Hub</h3>
                        </div>
                    </div>

                    <div className="p-4 bg-[#232323] border-b border-[#404040] space-y-4">
                        {!isSharing ? (
                            <Button
                                onClick={() => setIsSharing(true)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                            >
                                <Plus className="w-4 h-4" /> Share Resource
                            </Button>
                        ) : (
                            <div className="space-y-3 bg-[#1A1A1A] p-3 rounded-lg border border-[#333]">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant={shareType === 'link' ? 'default' : 'outline'}
                                        onClick={() => setShareType('link')}
                                        className="flex-1 text-xs"
                                    >
                                        Link
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={shareType === 'file' ? 'default' : 'outline'}
                                        onClick={() => setShareType('file')}
                                        className="flex-1 text-xs"
                                    >
                                        File
                                    </Button>
                                </div>
                                <Input
                                    placeholder="Title"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="bg-[#2A2A2A] border-[#444] h-8 text-xs text-white"
                                />
                                <Input
                                    placeholder={shareType === 'link' ? "URL" : "File Description"}
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                    className="bg-[#2A2A2A] border-[#444] h-8 text-xs text-white"
                                />

                                {shareType === 'file' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full text-xs border-dashed border-[#444] hover:border-blue-500/50 hover:bg-blue-500/5 text-gray-300 gap-2"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Paperclip className="w-3 h-3" />
                                        {selectedFile ? `Change File (${selectedFile.name})` : "Upload File from Device"}
                                    </Button>
                                )}

                                <div className="flex gap-2 pt-1">
                                    <Button size="sm" variant="ghost" className="flex-1 text-xs text-white" onClick={() => {
                                        setIsSharing(false);
                                        setSelectedFile(null);
                                    }}>Cancel</Button>
                                    <Button size="sm" className="flex-1 text-xs bg-blue-600" onClick={handleShare}>Share</Button>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            {['all', 'files', 'links'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs capitalize transition-colors",
                                        activeTab === tab ? "bg-blue-600 text-white" : "bg-[#2A2A2A] text-gray-400 hover:text-white"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {filteredResources.length > 0 ? (
                            filteredResources.map((res) => {
                                const isLink = res.type === 'link';
                                const fileName = res.metadata?.fileName || '';
                                const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
                                const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(fileExt);
                                const isPdf = fileExt === 'pdf';
                                const isDoc = ['doc', 'docx', 'txt'].includes(fileExt);
                                const isPpt = ['ppt', 'pptx'].includes(fileExt);

                                // Standardized UTC-to-IST parsing
                                const date = (() => {
                                    if (!res.timestamp) return new Date();

                                    // Handle string normalization
                                    let ts = res.timestamp.replace(' ', 'T');
                                    if (!ts.includes('Z') && !ts.includes('+') && !(/[-+]\d{2}:?\d{2}$/.test(ts))) {
                                        ts += 'Z';
                                    }
                                    return new Date(ts);
                                })();

                                const formatTime = (d: Date) => {
                                    return d.toLocaleTimeString('en-US', {
                                        timeZone: 'Asia/Kolkata',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                    }).toUpperCase();
                                };

                                const formatDate = (d: Date) => {
                                    return d.toLocaleDateString('en-GB', {
                                        timeZone: 'Asia/Kolkata',
                                        day: '2-digit',
                                        month: 'short'
                                    });
                                };

                                return (
                                    <div key={res.id} className="bg-[#232323] border border-[#333] p-4 rounded-xl hover:border-blue-500/30 transition-all group relative overflow-hidden">
                                        {/* Content type accent */}
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />

                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-500/10">
                                                    {isLink ? (
                                                        <Bot className="w-5 h-5 text-blue-400" />
                                                    ) : isImage ? (
                                                        <Video className="w-5 h-5 text-blue-400" />
                                                    ) : isPdf ? (
                                                        <FileText className="w-5 h-5 text-red-400" />
                                                    ) : isDoc ? (
                                                        <FileText className="w-5 h-5 text-blue-300" />
                                                    ) : (
                                                        <Paperclip className="w-5 h-5 text-blue-400" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate block">{res.title}</span>
                                                    <span className="text-[10px] text-gray-500 mt-0.5 block italic truncate">
                                                        by {res.sender_name}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <span className="text-[10px] text-gray-500 font-medium">
                                                    {formatDate(date)} • {formatTime(date)}
                                                </span>
                                                {currentUser?.id === res.sender_id && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setResourceToDelete({ id: res.id, meetingId: meeting?.id! });
                                                            setShowDeleteConfirm(true);
                                                        }}
                                                        className="p-1 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Delete resource"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3 text-xs text-gray-400 line-clamp-2 leading-relaxed opacity-80 italic">
                                            {res.content}
                                        </div>

                                        <div className="mt-4 flex items-center justify-between border-t border-[#333] pt-3">
                                            <div className="flex items-center gap-2">
                                                {!isLink && res.metadata?.fileSize && (
                                                    <span className="text-[10px] text-gray-500 bg-[#2A2A2A] px-2 py-0.5 rounded">
                                                        {(res.metadata.fileSize / 1024).toFixed(1)} KB
                                                    </span>
                                                )}
                                                {isLink && (
                                                    <span className="text-[10px] text-blue-400/70 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                                                        Link
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-2 font-medium px-3"
                                                onClick={async () => {
                                                    if (isLink) {
                                                        const url = res.content.match(/https?:\/\/[^\s]+/)?.[0] || (res.content.startsWith('http') ? res.content : `https://${res.content}`);
                                                        window.open(url, '_blank');
                                                    } else {
                                                        // Direct File Download Logic
                                                        const fileName = res.metadata?.fileName || res.title;
                                                        try {
                                                            let blob;
                                                            if (res.metadata?.fileData) {
                                                                // Convert Base64/DataURL back to Blob using fetch on data URL
                                                                const response = await fetch(res.metadata.fileData);
                                                                blob = await response.blob();
                                                            } else {
                                                                // Fallback for older shares
                                                                blob = new Blob([res.content], { type: res.metadata?.fileType || 'text/plain' });
                                                            }

                                                            const url = window.URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.style.display = 'none';
                                                            a.href = url;
                                                            a.download = fileName;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            window.URL.revokeObjectURL(url);
                                                            document.body.removeChild(a);
                                                            toast.success(`Downloading ${fileName}...`);
                                                        } catch (err) {
                                                            console.error("Download error:", err);
                                                            toast.error("Failed to download file");
                                                        }
                                                    }
                                                }}
                                            >
                                                {isLink ? "Open Link" : (
                                                    <>
                                                        Download
                                                        <Download className="w-3.5 h-3.5" />
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-8">
                                <Plus className="w-12 h-12 mb-4" />
                                <p className="text-sm">No resources shared yet.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                        onClick={() => setShowDeleteConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 12 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 12 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                            className="bg-[#1C1C1C] border border-[#333] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Icon + Title */}
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <Trash2 className="w-5 h-5 text-red-400" />
                                </div>
                                <h3 className="text-base font-semibold text-white">Delete Resource</h3>
                            </div>

                            {/* Message */}
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Are you sure you want to delete this shared resource? This action cannot be undone.
                            </p>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 h-9 rounded-lg border border-[#404040] bg-transparent text-sm text-gray-300 hover:bg-[#2A2A2A] hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (resourceToDelete) {
                                            deleteResource(resourceToDelete.id, resourceToDelete.meetingId);
                                        }
                                        setShowDeleteConfirm(false);
                                        setResourceToDelete(null);
                                    }}
                                    className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-sm text-white font-medium transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AnimatePresence>
    );
}
