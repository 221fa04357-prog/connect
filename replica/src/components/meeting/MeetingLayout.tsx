
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
} from "@/components/ui";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui';
import {
    Send, SmilePlus, X, Search, Mic, MicOff, Video, VideoOff,
    Hand, MoreVertical, Crown, Shield, Sparkles, Copy, ThumbsUp,
    ThumbsDown, Bot, ListTodo, FileText, MessageSquare, Check,
    Plus, AlertCircle, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useChatStore } from '@/stores/useChatStore';
import { useAIStore } from '@/stores/useAIStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ChatMessage, Participant } from '@/types';
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
        setSelectedRecipientId
    } = useChatStore();

    const [input, setInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentUser = useAuthStore.getState().user;
    const currentUserId = currentUser?.id || 'current-user';

    /* ---------------- DERIVED COUNTS ---------------- */

    const publicMessages = messages.filter(m => m.type === 'public');

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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeTab, selectedRecipientId, typingUsers]);

    /* ---------------- SEND MESSAGE ---------------- */

    const handleSend = () => {
        if (!input.trim()) return;

        sendMessage(input, activeTab, activeTab === 'private' ? selectedRecipientId : undefined);
        setInput('');
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
                                <Select value={selectedRecipientId || ''} onValueChange={setSelectedRecipientId}>
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
                                onMessageClick={(userId) => {
                                    if (userId !== currentUserId) {
                                        setSelectedRecipientId(userId);
                                    }
                                }}
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
                                onChange={handleInputChange}
                                placeholder={activeTab === 'private' ? "Type a private message..." : "Type a message..."}
                                className="flex-1 bg-transparent border-none text-white focus-visible:ring-0"
                                onBlur={() => sendTypingStatus(false)}
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

function MessageList({
    messages,
    participants,
    messagesEndRef,
    onMessageClick,
}: {
    messages: ChatMessage[];
    participants: { id: string; name: string }[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onMessageClick?: (userId: string) => void;
}) {
    const { typingUsers } = useChatStore();

    const { user } = useAuthStore();
    const currentUserId = user?.id || 'current-user';

    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 no-scrollbar">
            {messages.map(msg => {
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
                        className={cn('flex flex-col gap-1', isMe ? 'items-end' : 'items-start')}
                        onClick={() => {
                            if (msg.type === 'private' && onMessageClick) {
                                onMessageClick(isMe ? (msg.recipientId || '') : msg.senderId);
                            }
                        }}
                    >
                        <div className="text-xs text-gray-400">
                            {displayName} •{' '}
                            {msg.timestamp.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            })}
                        </div>

                        <div
                            className={cn(
                                'px-4 py-2 rounded-2xl text-sm max-w-[75%] cursor-pointer transition-colors',
                                isMe
                                    ? 'bg-[#0B5CFF] text-white rounded-br-none hover:bg-[#0046D5]'
                                    : 'bg-[#2A2A2A] text-gray-200 rounded-bl-none hover:bg-[#333]'
                            )}
                        >
                            {msg.content}
                        </div>
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
    } = useParticipantsStore();
    const { localUserId } = useChatStore();

    const [searchQuery, setSearchQuery] = useState('');

    const { user } = useAuthStore();
    const { meeting, isJoinedAsHost } = useMeetingStore();

    /** Current participant from store */
    const currentUserParticipant = participants.find(p => p.id === user?.id);
    const currentRole = (currentUserParticipant && (transientRoles[currentUserParticipant.id] || currentUserParticipant.role)) || 'participant';

    /** Resolve host status dynamically from state or participant list */
    const isHost = isJoinedAsHost || currentRole === 'host';

    const isCoHost = currentRole === 'co-host';
    const canControl = isHost || isCoHost;
    const canChangeRoles = isHost;
    const isOriginalHost = meeting?.originalHostId === user?.id;
    const { setLocalStream, toggleAudio, toggleVideo } = useMeetingStore();

    const handleAudioToggle = async () => {
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

    /** SEARCH */
    const filteredParticipants = participants.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    /** 🔑 MUTE-ALL STATE */
    const manageableParticipants = participants.filter(p => {
        const role = transientRoles[p.id] || p.role;
        return role === 'participant' || role === 'co-host';
    });
    const allMuted =
        manageableParticipants.length > 0 &&
        manageableParticipants.every(p => p.isAudioMuted === true);

    return (
        <AnimatePresence>
            {isParticipantsOpen && (
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
                        <h3 className="text-lg font-semibold">
                            Participants ({participants.length})
                        </h3>
                        {/* Close button moved to TopBar */}
                    </div>

                    {/* SEARCH & HOST CONTROLS */}
                    <div className="p-4 border-b border-[#404040] flex flex-col gap-3 md:flex-row md:items-center md:gap-2 flex-shrink-0">
                        <div className="relative flex-[2.5] min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search"
                                className="pl-9 h-9 bg-[#232323] border-[#404040] text-sm"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-none">
                            {canControl && (
                                <Button
                                    onClick={() => {
                                        if (allMuted) {
                                            if (confirm('Unmute all participants?')) {
                                                useChatStore.getState().unmuteAll(useMeetingStore.getState().meeting?.id || '');
                                            }
                                        } else {
                                            if (confirm('Mute all participants?')) {
                                                useChatStore.getState().muteAll(useMeetingStore.getState().meeting?.id || '');
                                            }
                                        }
                                    }}
                                    variant="ghost"
                                    className="bg-[#2A2A2A] hover:bg-[#333] text-white border-none h-9 px-2 md:px-3 text-xs sm:text-sm"
                                >
                                    {allMuted ? (
                                        <>
                                            <Mic className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                                            Unmute All
                                        </>
                                    ) : (
                                        <>
                                            <MicOff className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                                            Mute All
                                        </>
                                    )}
                                </Button>
                            )}

                            {isHost && (
                                <Button
                                    onClick={() => {
                                        if (videoRestricted) {
                                            if (confirm('Allow participants to start video?')) {
                                                useChatStore.getState().allowVideoAll(useMeetingStore.getState().meeting?.id || '');
                                                setVideoRestriction(false);
                                            }
                                        } else {
                                            if (confirm('Stop all participant videos and restrict them?')) {
                                                useChatStore.getState().stopVideoAll(useMeetingStore.getState().meeting?.id || '');
                                                setVideoRestriction(true);
                                            }
                                        }
                                    }}
                                    variant="outline"
                                    className="h-9 px-2 border-[#404040] hover:bg-[#2D2D2D] text-xs sm:text-sm"
                                >
                                    {videoRestricted ? (
                                        <>
                                            <Video className="w-3.5 h-3.5 mr-1 text-green-500" />
                                            Enable All
                                        </>
                                    ) : (
                                        <>
                                            <VideoOff className="w-3.5 h-3.5 mr-1 text-red-500" />
                                            Disable All
                                        </>
                                    )}
                                </Button>
                            )}
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
                                                        onClick={() => useChatStore.getState().admitParticipant(useMeetingStore.getState().meeting?.id || '', person.id)}
                                                        className="bg-green-500 hover:bg-green-600 text-white font-bold h-8 px-4"
                                                    >
                                                        Admit
                                                    </Button>
                                                    <button
                                                        onClick={() => useChatStore.getState().rejectParticipant(useMeetingStore.getState().meeting?.id || '', person.id)}
                                                        className="text-white hover:text-gray-300 text-sm font-medium transition-colors"
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

                        {/* PARTICIPANTS LIST */}
                        {filteredParticipants.map(participant => {
                            const displayedRole = transientRoles[participant.id] || participant.role;
                            const coHostCount = participants.filter(p => (transientRoles[p.id] || p.role) === 'co-host').length;
                            const hostCount = participants.filter(p => (transientRoles[p.id] || p.role) === 'host').length;

                            const isCurrentUser =
                                participant.id === user?.id ||
                                participant.id === `participant-${user?.id}` ||
                                participant.id === localUserId ||
                                (user?.role === 'host' && participant.id === 'participant-1');

                            return (
                                <ParticipantItem
                                    key={participant.id}
                                    participant={participant}
                                    isCurrentUser={isCurrentUser}
                                    canControl={canControl}
                                    canChangeRoles={canChangeRoles}
                                    isOriginalHost={isOriginalHost}
                                    onToggleHand={() => toggleHandRaise(participant.id)}
                                    onToggleMute={participant.id === user?.id ? handleAudioToggle : () => {
                                        if (participant.isAudioMuted) {
                                            unmuteParticipant(participant.id);
                                        } else {
                                            muteParticipant(participant.id);
                                        }
                                    }}
                                    onMakeHost={() => makeHost(participant.id)}
                                    onMakeCoHost={() => makeCoHost(participant.id)}
                                    onRemove={() => removeParticipant(participant.id)}
                                    onRevokeHost={() => revokeHost(participant.id)}
                                    onRevokeCoHost={() => revokeCoHost(participant.id)}
                                    onToggleVideoAllowed={() => setVideoAllowed(participant.id, !(participant.isVideoAllowed !== false))}
                                    onToggleVideo={participant.id === user?.id ? handleVideoToggle : undefined}
                                    displayedRole={displayedRole}
                                    coHostCount={coHostCount}
                                    hostCount={hostCount}
                                />
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

interface ParticipantItemProps {
    participant: Participant;
    isCurrentUser: boolean;
    canControl: boolean;
    canChangeRoles?: boolean;
    isOriginalHost?: boolean;
    onToggleHand: () => void;
    onToggleMute: () => void;
    onMakeHost: () => void;
    onMakeCoHost: () => void;
    onRemove: () => void;
    onRevokeHost: () => void;
    onRevokeCoHost: () => void;
    onToggleVideoAllowed: () => void;
    onToggleVideo?: () => void;
    displayedRole?: Participant['role'];
    coHostCount: number;
    hostCount: number;
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
    onRevokeHost,
    onRevokeCoHost,
    onToggleVideoAllowed,
    onToggleVideo,
    isOriginalHost = false,
    displayedRole = participant.role,
    coHostCount,
    hostCount,
}: ParticipantItemProps) {
    const effectiveRole = displayedRole || participant.role;

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
                            <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                        {effectiveRole === 'co-host' && (
                            <Shield className="w-4 h-4 text-purple-500" />
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                        <button
                            onClick={isCurrentUser ? onToggleMute : undefined}
                            className={cn(
                                "transition-opacity hover:opacity-80",
                                !isCurrentUser && "cursor-default"
                            )}
                        >
                            {participant.isAudioMuted ? (
                                <MicOff className="w-3 h-3 text-red-500" />
                            ) : (
                                <Mic className="w-3 h-3 text-green-500" />
                            )}
                        </button>
                        <button
                            onClick={isCurrentUser ? onToggleVideo : undefined}
                            className={cn(
                                "transition-opacity hover:opacity-80",
                                !isCurrentUser && "cursor-default"
                            )}
                        >
                            {participant.isVideoOff ? (
                                <VideoOff className="w-3 h-3 text-red-500" />
                            ) : (
                                <Video className="w-3 h-3 text-green-500" />
                            )}
                        </button>
                        {participant.isHandRaised && (
                            <Hand className="w-3 h-3 text-yellow-500" />
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
                        className={cn(
                            'hover:bg-[#2D2D2D]',
                            participant.isHandRaised && 'text-yellow-500'
                        )}
                    >
                        <Hand className="w-4 h-4" />
                    </Button>
                )}

                {canControl && !isCurrentUser && (
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
                            {(effectiveRole === 'participant' || (effectiveRole === 'co-host' && canChangeRoles)) && (
                                <DropdownMenuItem onClick={onToggleMute}>
                                    <MicOff className="w-4 h-4 mr-2" />
                                    {participant.isAudioMuted ? 'Unmute' : 'Mute'}
                                </DropdownMenuItem>
                            )}

                            {canControl && (effectiveRole === 'participant' || (effectiveRole === 'co-host' && canChangeRoles)) && (
                                <DropdownMenuItem onClick={onToggleVideoAllowed}>
                                    {participant.isVideoAllowed === false ? (
                                        <>
                                            <Video className="w-4 h-4 mr-2 text-green-500" />
                                            Allow Video
                                        </>
                                    ) : (
                                        <>
                                            <VideoOff className="w-4 h-4 mr-2 text-red-500" />
                                            Stop Video
                                        </>
                                    )}
                                </DropdownMenuItem>
                            )}

                            {canChangeRoles && (
                                <>
                                    {effectiveRole !== 'host' && (
                                        <DropdownMenuItem
                                            onClick={() => {
                                                if (hostCount >= 2) {
                                                    alert('Cannot add host: Maximum 1 additional host allowed.');
                                                    return;
                                                }
                                                onMakeHost();
                                            }}
                                        >
                                            <Crown className="w-4 h-4 mr-2" />
                                            Make Host
                                        </DropdownMenuItem>
                                    )}

                                    {effectiveRole === 'host' && (
                                        <DropdownMenuItem onClick={onRevokeHost} className="text-yellow-400">
                                            <Crown className="w-4 h-4 mr-2" />
                                            Remove Host
                                        </DropdownMenuItem>
                                    )}

                                    {effectiveRole !== 'co-host' && effectiveRole !== 'host' && (
                                        <DropdownMenuItem
                                            onClick={() => {
                                                if (coHostCount >= 2) {
                                                    alert('Cannot add co-host: Maximum 2 co-hosts allowed.');
                                                    return;
                                                }
                                                onMakeCoHost();
                                            }}
                                        >
                                            <Shield className="w-4 h-4 mr-2" />
                                            Make Co-Host
                                        </DropdownMenuItem>
                                    )}

                                    {effectiveRole === 'co-host' && (
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

                            <DropdownMenuItem
                                onClick={() => {
                                    if (effectiveRole === 'host') {
                                        alert('Cannot remove a participant with Host role. Revoke Host role first.');
                                        return;
                                    }
                                    onRemove();
                                }}
                                className="text-red-500"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Remove
                            </DropdownMenuItem>
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
                    meetingId: meeting?.id
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

            if (action === "Summarize last 5 minutes") {
                contextTranscript = chatMessages
                    .slice(-15) // Last 15 messages ~5 mins
                    .map(m => `${m.senderName}: ${m.content}`)
                    .join('\n');
                prompt = `Provide a detailed summary of the conversation that happened in the last 5 minutes. Focus on the specific details of this recent segment. Transcript: \n\n${contextTranscript}`;
            } else if (action === "Create meeting recap") {
                contextTranscript = chatMessages
                    .map(m => `${m.senderName}: ${m.content}`)
                    .join('\n');
                prompt = `Provide a high-level executive recap of the entire meeting so far. Highlight the main objectives, key outcomes, and overall progress. Transcript: \n\n${contextTranscript}`;
            } else if (action === "Draft follow-up email") {
                contextTranscript = chatMessages
                    .map(m => `${m.senderName}: ${m.content}`)
                    .join('\n');
                prompt = `Based on the meeting transcript, draft a professional follow-up email. Include a thank you note, a summary of what was discussed, and a clear list of next steps. Transcript: \n\n${contextTranscript}`;
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
                    meetingId: meeting?.id
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

        const transcript = chatMessages.map(m => `${m.senderName}: ${m.content}`).join('\n');
        if (!transcript.trim()) {
            toast.error("Transcript is empty. Chat a bit before suggesting actions.");
            return;
        }

        setIsSuggestingActions(true);

        try {
            const prompt = `Based on this meeting transcript, identify specific actionable tasks OR suggest logical next steps based on the discussion topics. Aim to provide practical items even if not explicitly stated as todos. Return ONLY a JSON array of strings, e.g. ["Research X", "Set up follow-up", "Update document"]. Transcript: \n\n${transcript}`;

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
            const transcript = chatMessages.map(m => `${m.senderName}: ${m.content}`).join('\n');
            const prompt = `Provide a bulleted list of key summary points for this meeting so far. Return ONLY the bullet points, one per line, starting with "• ". Transcript: \n\n${transcript}`;

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
        doc.text("Generated by ConnectPro AI Companion", margin, yPos);
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
                        <Button variant="ghost" size="icon" onClick={toggleAICompanion} className="hover:bg-[#333] text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </Button>
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
