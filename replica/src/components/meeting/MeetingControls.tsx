import { useState, useRef, useEffect } from 'react'; // Re-trigger IDE

import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Info, Copy, Check, Lock, Wifi, WifiOff,
    Video, Mic, Monitor, Keyboard, X,
    MicOff, VideoOff, MessageSquare, Users, MoreVertical,
    Grid3x3, User, Settings, ChevronUp, Share2, Circle, Smile,
    Hand, Sparkles, Clock, Maximize2, Minimize2, StopCircle, MousePointer2,
    Undo, Redo, Download
} from 'lucide-react';

import { Button } from '@/components/ui';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui';
import { Input } from '@/components/ui';
import { Label } from '@/components/ui';
import { Switch } from '@/components/ui';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui';
import { SubscriptionModal } from '@/components/ui';

import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useAIStore } from '@/stores/useAIStore';
import { useChatStore } from '@/stores/useChatStore';
import { cn } from '@/lib/utils';
import { Reaction } from '@/types';
import { useIsMobile } from '@/hooks';

// --- TopBar.tsx ---

function TopBar() {
    const {
        meeting,
        isRecording,
        connectionQuality,
        isWhiteboardOpen,
        extendMeetingTime,
        isParticipantsOpen,
        isChatOpen,
        toggleParticipants,
        toggleChat
    } = useMeetingStore();
    const isMobile = useIsMobile();
    const { participants } = useParticipantsStore();
    const [copied, setCopied] = useState(false);
    // Removed controlled state usage to fix closing issue

    // Derived state for panel close button
    const isPanelOpen = isParticipantsOpen || isChatOpen;
    const handleClosePanel = () => {
        if (isParticipantsOpen) toggleParticipants();
        if (isChatOpen) toggleChat();
    };

    const getConnectionColor = () => {
        switch (connectionQuality) {
            case 'excellent': return 'text-green-400';
            case 'good': return 'text-green-500';
            case 'poor': return 'text-yellow-500';
            case 'offline': return 'text-red-500';
            default: return 'text-gray-400';
        }
    };

    const getConnectionLabel = () => {
        switch (connectionQuality) {
            case 'excellent': return 'Excellent';
            case 'good': return 'Good';
            case 'poor': return 'Poor';
            case 'offline': return 'Offline';
            default: return 'Unknown';
        }
    };

    // Draggable State
    const [pos, setPos] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('meeting-info-pos');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error("Failed to parse saved position", e);
                }
            }
        }
        return { x: 16, y: 16 };
    });

    useEffect(() => {
        localStorage.setItem('meeting-info-pos', JSON.stringify(pos));
    }, [pos]);

    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const rafRef = useRef<number | null>(null);

    // Derive host name
    const host = participants.find(p => p.id === meeting?.hostId);
    const hostName = host ? host.name : 'Host';

    const user = useAuthStore(state => state.user);
    const isHost = meeting?.hostId === user?.id || user?.id === 'host';

    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (!meeting) return;
        if (!meeting.endTime && (!meeting.startTime || !meeting.duration)) return;

        const updateTimer = () => {
            let endTime = 0;
            if (meeting.endTime) {
                endTime = Number(meeting.endTime);
            } else if (meeting.startTime && meeting.duration) {
                const start = new Date(meeting.startTime).getTime();
                endTime = start + (meeting.duration * 60 * 1000);
            }

            const now = Date.now();
            const diff = endTime - now;

            if (diff <= 0) {
                setTimeLeft("00:00");
            } else {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [meeting]);

    // Extend Meeting Logic
    const [showExtendPopup, setShowExtendPopup] = useState(false);
    const [hasShownExtendPopup, setHasShownExtendPopup] = useState(false); // Only show once per session
    const isPro = user?.subscriptionPlan === 'pro' || user?.subscriptionPlan === 'enterprise';

    useEffect(() => {
        if (!timeLeft || !isHost || hasShownExtendPopup) return;

        // Time format is MM:SS
        // Parse current time left. If <= 5:00, show popup
        const [m, s] = timeLeft.split(':').map(Number);
        const totalSeconds = (m * 60) + s;

        if (totalSeconds > 0 && totalSeconds <= 300) { // 5 minutes
            setShowExtendPopup(true);
            setHasShownExtendPopup(true);
        }
    }, [timeLeft, isHost, hasShownExtendPopup]);

    const handleExtendMeeting = (minutes: number) => {
        if (!isPro) {
            import('sonner').then(({ toast }) => {
                toast.error('Upgrade Required', {
                    description: 'You need a Pro plan to extend meetings.',
                    action: {
                        label: 'Upgrade',
                        onClick: () => window.open('/pricing', '_blank')
                    }
                });
            });
            return;
        }

        extendMeetingTime(minutes);
        setShowExtendPopup(false);
        setHasShownExtendPopup(false); // Allow showing again if time runs low again

        import('sonner').then(({ toast }) => {
            toast.success(`Meeting Extended`, {
                description: `Added ${minutes} minutes to the meeting.`,
            });
        });
    };

    // Meeting Link
    const inviteLink = meeting?.id
        ? `${window.location.origin}/#/join/${meeting.id}`
        : window.location.href;

    const copyTextAreaRef = useRef<HTMLTextAreaElement>(null);

    const handleCopyLink = async (e?: React.MouseEvent) => {
        // Prevent event from bubbling up and closing the dropdown
        if (e) {
            e.stopPropagation();
        }

        console.log('Copy link clicked!', inviteLink);

        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);

            console.log('Copied successfully via clipboard API');

            // Show toast notification
            import('sonner').then(({ toast }) => {
                toast.success('Meeting link copied!', {
                    description: 'Share this link with participants',
                    duration: 3000,
                    position: 'top-center'
                });
            });
        } catch (err) {
            console.error('Clipboard API failed, trying fallback', err);

            // Fallback using the hidden textarea within the modal
            if (copyTextAreaRef.current) {
                copyTextAreaRef.current.focus();
                copyTextAreaRef.current.select();
                copyTextAreaRef.current.setSelectionRange(0, 99999); // For mobile devices

                try {
                    const successful = document.execCommand('copy');
                    console.log('execCommand result:', successful);
                    if (successful) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        import('sonner').then(({ toast }) => {
                            toast.success('Meeting link copied!', {
                                description: 'Share this link with participants',
                                duration: 3000,
                                position: 'top-center'
                            });
                        });
                    } else {
                        throw new Error('execCommand failed');
                    }
                } catch (e) {
                    console.error('Fallback copy failed', e);
                    import('sonner').then(({ toast }) => {
                        toast.error('Failed to copy link', {
                            description: 'Please copy manually',
                            duration: 3000,
                            position: 'top-center'
                        });
                    });
                }
            } else {
                console.error('Copy textarea ref not available');
                import('sonner').then(({ toast }) => {
                    toast.error('Failed to copy link', {
                        description: 'Please copy manually',
                        duration: 3000,
                        position: 'top-center'
                    });
                });
            }
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        const rect = e.currentTarget.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        if (rafRef.current) return;

        rafRef.current = requestAnimationFrame(() => {
            const iconWidth = 44; // Approx size of the lock button
            const iconHeight = 44;

            let nextX = e.clientX - dragOffset.current.x;
            let nextY = e.clientY - dragOffset.current.y;

            // Clamping to screen boundaries
            nextX = Math.max(0, Math.min(nextX, window.innerWidth - iconWidth));
            nextY = Math.max(0, Math.min(nextY, window.innerHeight - iconHeight));

            setPos({ x: nextX, y: nextY });
            rafRef.current = null;
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    return (
        <div className="absolute inset-0 z-[60] pointer-events-none">
            <div
                className={cn("absolute pointer-events-auto touch-none select-none", isWhiteboardOpen && "hidden")}
                style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    zIndex: 51
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <div className={cn(
                            "flex items-center gap-2 cursor-grab group transition-all",
                            isDragging && "cursor-grabbing scale-110"
                        )}>
                            <div className="bg-green-500 rounded-full p-2 flex items-center justify-center shadow-lg">
                                <Lock className="w-4 h-4 text-white" />
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        sideOffset={10}
                        className="w-[320px] bg-[#1C1C1C] border-[#333] text-white p-0 shadow-xl overflow-hidden pointer-events-auto z-[200]"
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerMove={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-[#333]">
                            <h3 className="font-semibold text-lg">{meeting?.title || 'Meeting Topic'}</h3>
                            <p className="text-xs text-gray-400 mt-1">
                                Hosted by {hostName}
                            </p>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-400">Meeting ID</span>
                                <span className="text-sm font-medium">{meeting?.id || '--- --- ---'}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-400">Host</span>
                                <span className="text-sm font-medium">{hostName}</span>
                            </div>

                            {meeting?.password && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Passcode</span>
                                    <span className="text-sm font-medium">{meeting.password}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <span className="text-sm text-gray-400">Invite Link</span>
                                <div className="flex items-center gap-2 bg-[#2A2A2A] rounded p-2">
                                    <span className="text-xs text-gray-300 truncate flex-1 select-all">
                                        {inviteLink}
                                    </span>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 hover:bg-[#3A3A3A] hover:text-white flex-shrink-0"
                                        onClick={(e) => handleCopyLink(e)}
                                    >
                                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                    </Button>
                                </div>
                                <div
                                    className="flex items-center gap-2 text-blue-400 cursor-pointer hover:underline text-sm mt-1"
                                    onClick={(e) => handleCopyLink(e)}
                                >
                                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                                </div>
                                {/* Hidden textarea for fallback copy */}
                                <textarea
                                    ref={copyTextAreaRef}
                                    defaultValue={inviteLink}
                                    style={{
                                        position: 'fixed',
                                        left: '0',
                                        top: '0',
                                        opacity: 0,
                                        pointerEvents: 'none',
                                        width: '1px',
                                        height: '1px'
                                    }}
                                />
                            </div>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div
                className="absolute top-4 right-4 pointer-events-auto flex items-center gap-2"
            >
                {/* Connection Status */}
                {(connectionQuality === 'poor' || connectionQuality === 'offline') && (
                    <div
                        className={cn(
                            "bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-lg transition-all animate-pulse border-red-500/50"
                        )}
                    >
                        {connectionQuality === 'offline' ? (
                            <WifiOff className="w-4 h-4 text-red-500" />
                        ) : (
                            <Wifi className={cn("w-4 h-4", getConnectionColor())} />
                        )}
                        <span
                            className={cn(
                                "text-[10px] font-bold tracking-tight uppercase",
                                getConnectionColor()
                            )}
                        >
                            {getConnectionLabel()}
                        </span>
                    </div>
                )}

                {/* Recording Indicator */}
                {isRecording && (
                    <div className="bg-red-600/90 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full" />
                        <span className="font-semibold tracking-wide uppercase">
                            REC
                        </span>
                    </div>
                )}

                {/* Timer */}
                {!isWhiteboardOpen && timeLeft && (
                    <div className={cn(
                        "backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-lg",
                        (timeLeft === "00:00" || (timeLeft.length < 5 && timeLeft.startsWith("0:") && parseInt(timeLeft.split(":")[1]) < 30))
                            ? "bg-red-500/80 text-white animate-pulse"
                            : "bg-black/40 text-gray-200"
                    )}>
                        <Clock className="w-3 h-3" />
                        <span className="text-xs font-mono font-medium">{timeLeft}</span>
                    </div>
                )}

                {/* Panel Close Button (X) - Only visible when panel is open */}
                {isPanelOpen && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleClosePanel}
                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-white/20 text-white border border-white/10 shadow-lg"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>


            {/* Extend Meeting Warning Modal */}
            <AnimatePresence>
                {showExtendPopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 pointer-events-auto"
                        onClick={() => { }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-[#1C1C1C] border border-[#333] rounded-xl p-6 max-w-[400px] w-full shadow-2xl relative overflow-hidden pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Pro Badge or Upgrade Banner */}
                            {!isPro && (
                                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 h-1" />
                            )}

                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Clock className="w-8 h-8 text-yellow-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Meeting Ending Soon</h3>
                                <p className="text-gray-400">
                                    This meeting will end in less than 5 minutes.
                                    {isPro ? ' Would you like to extend it?' : ' Upgrade to extend the duration.'}
                                </p>
                            </div>

                            {isPro ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {[5, 10, 15].map((mins) => (
                                            <Button
                                                key={mins}
                                                variant="outline"
                                                onClick={() => handleExtendMeeting(mins)}
                                                className="bg-[#2A2A2A] border-[#333] hover:bg-[#3A3A3A] hover:text-white"
                                            >
                                                +{mins}m
                                            </Button>
                                        ))}
                                    </div>
                                    <Button
                                        onClick={() => setShowExtendPopup(false)}
                                        className="w-full bg-gray-700 hover:bg-gray-600 text-white mt-2"
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Button
                                        onClick={() => window.open('/pricing', '_blank')}
                                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold h-11"
                                    >
                                        Upgrade to Extend
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowExtendPopup(false)}
                                        className="w-full text-gray-400 hover:text-white hover:bg-[#2A2A2A]"
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- SettingsModal.tsx ---

function SettingsModal() {
    const { user } = useAuthStore();
    const {
        isSettingsOpen,
        toggleSettings,
        meeting,
        updateMeetingSettings,
        isJoinedAsHost,
        audioDevices,
        videoDevices,
        speakerDevices,
        selectedAudioId,
        selectedVideoId,
        selectedSpeakerId,
        enumerateDevices,
        setAudioDevice,
        setVideoDevice,
        setSpeakerDevice
    } = useMeetingStore();
    const { waitingRoomEnabled } = useParticipantsStore();
    const { toggleWaitingRoom } = useChatStore();

    const [settings, setSettings] = useState<any>({
        virtualBackground: 'none',
        backgroundBlur: false,
        hd: true,
        mirrorVideo: true,
        autoMute: false,
        autoVideo: true
    });

    const [loading, setLoading] = useState(false);
    const API = import.meta.env.VITE_API_URL || '';

    // Initial fetch of settings
    useEffect(() => {
        if (!isSettingsOpen) return;

        const fetchSettings = async () => {
            try {
                const res = await fetch(`${API}/api/user/settings`, {
                    headers: { 'x-user-id': user?.id || 'default-user' }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && Object.keys(data).length > 0) {
                        setSettings(prev => ({ ...prev, ...data }));
                    }
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
            }
        };

        fetchSettings();
    }, [isSettingsOpen, user?.id, API]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const userId = user?.id || 'default-user';
            const payload = {
                ...settings,
                audioInput: selectedAudioId,
                videoInput: selectedVideoId,
                audioOutput: selectedSpeakerId
            };

            const res = await fetch(`${API}/api/user/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                import('sonner').then(({ toast }) => {
                    toast.success('Settings saved', {
                        description: 'Your preferences have been updated.',
                        duration: 3000
                    });
                });
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setLoading(false);
            toggleSettings();
        }
    };

    if (!isSettingsOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={toggleSettings}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl max-h-[90vh] bg-[#232323] border border-[#404040] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                >
                    <div className="p-4 border-b border-[#404040] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Monitor className="w-5 h-5 text-blue-400" />
                            <h2 className="text-xl font-bold">Settings</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSettings}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <Tabs defaultValue="audio" className="flex flex-1 min-h-0 overflow-hidden">
                        <div className="w-48 border-r border-[#404040] p-2 bg-[#1C1C1C] overflow-y-auto hidden sm:block">
                            <TabsList className="flex flex-col h-auto bg-transparent w-full gap-1">
                                <TabsTrigger
                                    value="audio"
                                    className="w-full justify-start gap-2 data-[state=active]:bg-[#0B5CFF] data-[state=active]:text-white px-3 py-2 rounded-lg"
                                >
                                    <Mic className="w-4 h-4" />
                                    Audio
                                </TabsTrigger>
                                <TabsTrigger
                                    value="video"
                                    className="w-full justify-start gap-2 data-[state=active]:bg-[#0B5CFF] data-[state=active]:text-white px-3 py-2 rounded-lg"
                                >
                                    <Video className="w-4 h-4" />
                                    Video
                                </TabsTrigger>
                                <TabsTrigger
                                    value="general"
                                    className="w-full justify-start gap-2 data-[state=active]:bg-[#0B5CFF] data-[state=active]:text-white px-3 py-2 rounded-lg"
                                >
                                    <Monitor className="w-4 h-4" />
                                    General
                                </TabsTrigger>
                                <TabsTrigger
                                    value="shortcuts"
                                    className="w-full justify-start gap-2 data-[state=active]:bg-[#0B5CFF] data-[state=active]:text-white px-3 py-2 rounded-lg"
                                >
                                    <Keyboard className="w-4 h-4" />
                                    Shortcuts
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="sm:hidden border-b border-[#404040] bg-[#1C1C1C] shrink-0 overflow-x-auto no-scrollbar">
                            <TabsList className="flex h-auto bg-transparent p-1 gap-1">
                                <TabsTrigger value="audio" className="flex-1 whitespace-nowrap">Audio</TabsTrigger>
                                <TabsTrigger value="video" className="flex-1 whitespace-nowrap">Video</TabsTrigger>
                                <TabsTrigger value="general" className="flex-1 whitespace-nowrap">General</TabsTrigger>
                                <TabsTrigger value="shortcuts" className="flex-1 whitespace-nowrap">Shortcuts</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <TabsContent value="audio" className="p-6 m-0 space-y-6">
                                <div className="space-y-2">
                                    <Label>Microphone</Label>
                                    <Select
                                        value={selectedAudioId}
                                        onValueChange={setAudioDevice}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue placeholder="Select Microphone" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040] z-[200]">
                                            <SelectItem value="default">Default Microphone</SelectItem>
                                            {audioDevices.map((device) => (
                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Speaker</Label>
                                    <Select
                                        value={selectedSpeakerId}
                                        onValueChange={setSpeakerDevice}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue placeholder="Select Speaker" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040] z-[200]">
                                            <SelectItem value="default">Default Speaker</SelectItem>
                                            {speakerDevices.map((device) => (
                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <div className="space-y-0.5">
                                        <Label>Mute microphone when joining</Label>
                                        <p className="text-xs text-gray-500">You will be muted by default when you join a meeting</p>
                                    </div>
                                    <Switch
                                        checked={settings.autoMute}
                                        onCheckedChange={(checked) => setSettings({ ...settings, autoMute: checked })}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="video" className="p-6 m-0 space-y-6">
                                <div className="space-y-2">
                                    <Label>Camera</Label>
                                    <Select
                                        value={selectedVideoId}
                                        onValueChange={setVideoDevice}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue placeholder="Select Camera" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040] z-[200]">
                                            <SelectItem value="default">Default Camera</SelectItem>
                                            {videoDevices.map((device) => (
                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Virtual Background</Label>
                                    <Select
                                        value={settings.virtualBackground}
                                        onValueChange={(value) => setSettings({ ...settings, virtualBackground: value })}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040] z-[200]">
                                            <SelectItem value="none">None</SelectItem>
                                            <SelectItem value="blur">Blur Background</SelectItem>
                                            <SelectItem value="office">Office Background</SelectItem>
                                            <SelectItem value="beach">Beach Background</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <Label htmlFor="hd">Enable HD Video</Label>
                                    <Switch
                                        id="hd"
                                        checked={settings.hd}
                                        onCheckedChange={(checked) => setSettings({ ...settings, hd: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="mirrorVideo">Mirror my video</Label>
                                    <Switch
                                        id="mirrorVideo"
                                        checked={settings.mirrorVideo}
                                        onCheckedChange={(checked) => setSettings({ ...settings, mirrorVideo: checked })}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="general" className="p-6 m-0 space-y-6">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg text-white">Meeting Preferences</h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-[#1C1C1C] rounded-lg border border-[#404040]">
                                            <p className="text-sm text-gray-400">
                                                These settings will be applied to this meeting.
                                            </p>
                                        </div>

                                        {isJoinedAsHost && (
                                            <div className="space-y-4 pt-2">
                                                <div className="flex items-center justify-between p-4 bg-[#1C1C1C] rounded-lg border border-[#404040]">
                                                    <div className="space-y-0.5">
                                                        <Label htmlFor="waitingRoom">Enable Waiting Room</Label>
                                                        <p className="text-xs text-gray-500">New participants must be admitted by the host.</p>
                                                    </div>
                                                    <Switch
                                                        id="waitingRoom"
                                                        checked={waitingRoomEnabled}
                                                        onCheckedChange={(checked) => {
                                                            if (meeting?.id) {
                                                                toggleWaitingRoom(meeting.id, checked);
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                <div className="p-4 bg-[#1C1C1C] rounded-lg border border-[#404040] space-y-4">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Host Controls</h4>

                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <Label>Allow Microphones</Label>
                                                                <p className="text-xs text-gray-500">Participants can unmute themselves</p>
                                                            </div>
                                                            <Switch
                                                                checked={meeting?.settings?.micAllowed !== false}
                                                                onCheckedChange={(checked) => updateMeetingSettings({ micAllowed: checked })}
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <Label>Allow Cameras</Label>
                                                                <p className="text-xs text-gray-500">Participants can start their video</p>
                                                            </div>
                                                            <Switch
                                                                checked={meeting?.settings?.cameraAllowed !== false}
                                                                onCheckedChange={(checked) => updateMeetingSettings({ cameraAllowed: checked })}
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <Label>Allow Screen Sharing</Label>
                                                                <p className="text-xs text-gray-500">Participants can share their screen</p>
                                                            </div>
                                                            <Switch
                                                                checked={meeting?.settings?.screenShareAllowed !== false}
                                                                onCheckedChange={(checked) => updateMeetingSettings({ screenShareAllowed: checked })}
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <Label>Allow Chat</Label>
                                                                <p className="text-xs text-gray-500">Participants can send messages</p>
                                                            </div>
                                                            <Switch
                                                                checked={meeting?.settings?.chatAllowed !== false}
                                                                onCheckedChange={(checked) => updateMeetingSettings({ chatAllowed: checked })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label>Default View Mode</Label>
                                            <Select defaultValue="gallery">
                                                <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#232323] border-[#404040] z-[200]">
                                                    <SelectItem value="gallery">Gallery View</SelectItem>
                                                    <SelectItem value="speaker">Speaker View</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="shortcuts" className="p-6 m-0 space-y-4">
                                <h3 className="font-semibold text-lg text-white mb-2">Shortcuts</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { action: 'Mute/Unmute', shortcut: 'Alt + A' },
                                        { action: 'Video On/Off', shortcut: 'Alt + V' },
                                        { action: 'Share Screen', shortcut: 'Alt + S' },
                                        { action: 'Recording', shortcut: 'Alt + D' },
                                        { action: 'Chat', shortcut: 'Alt + C' },
                                        { action: 'Participants', shortcut: 'Alt + P' },
                                        { action: 'Reactions', shortcut: 'Alt + R' },
                                        { action: 'Raise/Lower Hand', shortcut: 'Alt + H' },
                                        { action: 'Whiteboard', shortcut: 'Alt + W' },
                                        { action: 'AI Companion', shortcut: 'Alt + I' },
                                        { action: 'Toggle View', shortcut: 'Alt + G' },
                                        { action: 'Settings', shortcut: 'Alt + T' },
                                        { action: 'Self View', shortcut: 'Alt + O' },
                                        { action: 'Leave', shortcut: 'Alt + L' }
                                    ].map((item) => (
                                        <div
                                            key={item.action}
                                            className="flex items-center justify-between p-3 bg-[#1C1C1C] rounded-lg border border-[#404040]"
                                        >
                                            <span className="text-[13px] text-gray-300">{item.action}</span>
                                            <kbd className="px-2 py-1 bg-[#232323] border border-[#404040] rounded text-[10px] font-mono text-blue-400 whitespace-nowrap">
                                                {item.shortcut}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    <div className="p-4 border-t border-[#404040] flex justify-end gap-3 bg-[#1C1C1C]">
                        <Button
                            variant="ghost"
                            onClick={toggleSettings}
                            className="text-gray-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-[#0B5CFF] hover:bg-blue-600 text-white px-6"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

// --- ShareScreenModal.tsx ---

interface ShareScreenModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

function ShareScreenModal({ open, onOpenChange, onConfirm }: ShareScreenModalProps) {
    const [sharingKey, setSharingKey] = useState('');
    const [error, setError] = useState('');

    const handleShare = () => {
        if (!sharingKey.trim()) {
            setError('Sharing key or Meeting ID is required');
            return;
        }
        if (sharingKey.length < 6) {
            setError('Invalid sharing key');
            return;
        }

        setError('');
        onConfirm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#1C1C1C] border-[#333] text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-blue-500" />
                        Share Screen
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="bg-[#2A2A2A] p-4 rounded-lg flex items-start gap-3">
                        <Lock className="w-5 h-5 text-gray-400 mt-1" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-white">Security Check</p>
                            <p className="text-xs text-gray-400">
                                Please enter the Sharing Key or Meeting ID displayed on the room screen to start sharing.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sharing-key" className="text-gray-300">Sharing Key / Meeting ID</Label>
                        <Input
                            id="sharing-key"
                            placeholder="Enter key..."
                            value={sharingKey}
                            onChange={(e) => {
                                setSharingKey(e.target.value);
                                setError('');
                            }}
                            className="bg-[#232323] border-[#404040] text-white focus:ring-blue-500"
                        />
                        {error && <p className="text-xs text-red-400">{error}</p>}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="hover:bg-[#333] text-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleShare}
                        disabled={!sharingKey.trim()}
                        className="bg-[#0B5CFF] hover:bg-[#0948c7] text-white"
                    >
                        Share Screen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- ControlBar.tsx ---

const reactionEmojis = ['👍', '❤️', '😂', '👏', '🎉', '😮'];

function ControlBar() {
    const navigate = useNavigate();
    // Store hooks
    const {
        meeting,
        isScreenSharing,
        isRecording,
        isChatOpen,
        isParticipantsOpen,
        viewMode,
        toggleScreenShare,
        toggleRecording,
        toggleChat,
        toggleParticipants,
        toggleSettings,
        toggleAudio,
        toggleVideo,
        isAudioMuted,
        isVideoOff,
        setViewMode,
        addReaction,
        leaveMeeting,
        setScreenShareStream,
        setRecordingStartTime,
        setLocalStream,
        extendMeetingTime,
        showSelfView,
        toggleSelfView,

        // Devices
        audioDevices,
        videoDevices,
        speakerDevices,
        selectedAudioId,
        selectedVideoId,
        selectedSpeakerId,
        enumerateDevices,
        setAudioDevice,
        setVideoDevice,
        setSpeakerDevice,

        // AI Companion
        toggleAICompanion,
        isAICompanionOpen,

        // Reactions
        showReactions,
        toggleReactions,

        // Whiteboard
        isWhiteboardOpen,
        toggleWhiteboard,
        setWhiteboardEditAccess,
        whiteboardStrokes,
        addWhiteboardStroke,
        updateWhiteboardStroke,
        clearWhiteboardStrokes,
        setWhiteboardStrokes,
        removeWhiteboardStroke,
        whiteboardInitiatorId,
        undoWhiteboardStroke,
        redoWhiteboardStroke,
        whiteboardRedoStack,

        // Mic & Video Confirm
        showMicConfirm,
        showVideoConfirm,
        setMicConfirm,
        setVideoConfirm,

        isJoinedAsHost
    } = useMeetingStore();

    // Enumerate devices on mount for the control bar dropdowns
    useEffect(() => {
        enumerateDevices();
    }, [enumerateDevices]);

    const { unreadCount, localUserId, emitParticipantUpdate, emitWhiteboardDraw, emitWhiteboardClear, emitWhiteboardToggle, emitWhiteboardUndo, emitWhiteboardRedo } = useChatStore();
    const { user, isSubscribed } = useAuthStore();
    const {
        participants,
        transientRoles,
        updateParticipant,
        toggleHandRaise,
        toggleParticipantAudio,
        toggleParticipantVideo
    } = useParticipantsStore();

    // Find current user participant
    const currentUserId = localUserId || user?.id;
    const currentParticipant = participants.find(p => p.id === currentUserId)
        || participants.find(p => p.id === `participant-${currentUserId}`)
        || (user?.id ? (participants.find(p => p.id === user.id) || participants.find(p => p.id === `participant-${user.id}`)) : null)
        || participants[0];

    const currentRole = currentParticipant ? (transientRoles[currentParticipant.id] || currentParticipant.role) : 'participant';
    const isHost = isJoinedAsHost || currentRole === 'host' || currentRole === 'co-host';
    const isHandRaised = !!currentParticipant?.isHandRaised;

    const isHostOrCoHost = currentParticipant?.role === 'host' || currentParticipant?.role === 'co-host' || isJoinedAsHost;
    const micAllowed = isHostOrCoHost || meeting?.settings?.micAllowed !== false;
    const videoAllowed = isHostOrCoHost || meeting?.settings?.cameraAllowed !== false;
    const screenShareAllowed = isHostOrCoHost || meeting?.settings?.screenShareAllowed !== false;

    // Toggle hand for self
    const handleToggleHand = () => {
        if (currentParticipant) toggleHandRaise(currentParticipant.id);
    };

    // Local state
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showScreenShareOptions, setShowScreenShareOptions] = useState(false);
    const [copiedMeetingLink, setCopiedMeetingLink] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const yesButtonRef = useRef<HTMLButtonElement>(null);

    // Auto-focus Yes button when modals open
    useEffect(() => {
        if (showMicConfirm || showVideoConfirm) {
            setTimeout(() => yesButtonRef.current?.focus(), 100);
        }
    }, [showMicConfirm, showVideoConfirm]);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // Whiteboard state
    const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'eraser'>('pen');
    const [whiteboardColor, setWhiteboardColor] = useState('#111');
    const [whiteboardSize, setWhiteboardSize] = useState(4);
    const [whiteboardDrawing, setWhiteboardDrawing] = useState(false);
    const [currentStrokeId, setCurrentStrokeId] = useState<string | null>(null);
    const [eraserPath, setEraserPath] = useState<number[][]>([]); // For eraser tool
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
    const isMobile = useIsMobile();

    // Optimization Refs
    const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastEmittedPointIndexRef = useRef<Record<string, number>>({});

    // Chat Badge Logic
    const displayUnreadCount = !isChatOpen ? (unreadCount > 99 ? '99+' : unreadCount) : 0;

    // RBAC for Whiteboard
    const whiteboardEditAccess = meeting?.settings?.whiteboardEditAccess || 'hostOnly';
    const canEditWhiteboard =
        currentParticipant?.role === 'host' ||
        (whiteboardEditAccess === 'coHost' && currentParticipant?.role === 'co-host') ||
        (whiteboardEditAccess === 'everyone');

    // Whiteboard handlers
    const openWhiteboard = () => {
        if (!canEditWhiteboard) return;
        if (!isWhiteboardOpen) {
            toggleWhiteboard();
            if (meeting?.id && currentUserId) emitWhiteboardToggle(meeting.id, true, currentUserId);
        }
    };

    useEffect(() => {
        if (isWhiteboardOpen && !canEditWhiteboard) {
            closeWhiteboard();
        }
    }, [isWhiteboardOpen, canEditWhiteboard]);

    const closeWhiteboard = () => {
        if (isWhiteboardOpen) {
            toggleWhiteboard(); // Always close locally

            // Only emit global toggle if current user is the initiator
            if (meeting?.id && currentUserId && currentUserId === whiteboardInitiatorId) {
                emitWhiteboardToggle(meeting.id, false, currentUserId);
            }
        }
        setWhiteboardDrawing(false);
        setEraserPath([]);
    };
    const clearWhiteboard = () => {
        if (!canEditWhiteboard) return;
        clearWhiteboardStrokes();
        setWhiteboardDrawing(false);
        setEraserPath([]);
        if (meeting?.id) emitWhiteboardClear(meeting.id);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleUndo = () => {
        if (!canEditWhiteboard) return;
        undoWhiteboardStroke();
        if (meeting?.id) {
            useChatStore.getState().emitWhiteboardUndo(meeting.id);
        }
    };

    const handleRedo = () => {
        if (!canEditWhiteboard) return;
        redoWhiteboardStroke();
        if (meeting?.id) {
            useChatStore.getState().emitWhiteboardRedo(meeting.id);
        }
    };

    const handleExportImage = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        // Fill with white background
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw the current canvas over it
        tempCtx.drawImage(canvas, 0, 0);

        // Download
        const link = document.createElement('a');
        link.download = `whiteboard-${Date.now()}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    };

    // Keyboard shortcuts for Undo/Redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isWhiteboardOpen) return;
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    handleUndo();
                } else if (e.key === 'y' || (e.key === 'Z' && e.shiftKey)) {
                    e.preventDefault();
                    handleRedo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isWhiteboardOpen, whiteboardStrokes, whiteboardRedoStack]); // Dependencies to ensure handlers have fresh state

    // Drawing logic (frontend only, no backend)
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!canEditWhiteboard) return;
        setWhiteboardDrawing(true);
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (whiteboardTool === 'pen') {
            const strokeId = `${user?.id || 'guest'}-${Date.now()}`;
            setCurrentStrokeId(strokeId);
            const newStroke = { id: strokeId, points: [[x, y]], color: whiteboardColor, size: whiteboardSize, tool: 'pen' };
            addWhiteboardStroke(newStroke);
            lastEmittedPointIndexRef.current[strokeId] = 0; // Reset emitted index
            if (meeting?.id) emitWhiteboardDraw(meeting.id, { type: 'start', stroke: newStroke });
        } else if (whiteboardTool === 'eraser') {
            setEraserPath([[x, y]]);
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!whiteboardDrawing || !canEditWhiteboard) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (whiteboardTool === 'pen' && currentStrokeId) {
            const stroke = whiteboardStrokes.find(s => s.id === currentStrokeId);
            if (stroke) {
                const newPoints = [...stroke.points, [x, y]];
                updateWhiteboardStroke(currentStrokeId, newPoints);

                // Throttled and Incremental Emission
                if (!throttleTimeoutRef.current) {
                    throttleTimeoutRef.current = setTimeout(() => {
                        throttleTimeoutRef.current = null;
                        if (meeting?.id) {
                            const currentStroke = useMeetingStore.getState().whiteboardStrokes.find(s => s.id === currentStrokeId);
                            if (currentStroke) {
                                const lastIndex = lastEmittedPointIndexRef.current[currentStrokeId] || 0;
                                const deltaPoints = currentStroke.points.slice(lastIndex + 1);
                                if (deltaPoints.length > 0) {
                                    emitWhiteboardDraw(meeting.id, {
                                        type: 'append',
                                        id: currentStrokeId,
                                        points: deltaPoints
                                    });
                                    lastEmittedPointIndexRef.current[currentStrokeId] = currentStroke.points.length - 1;
                                }
                            }
                        }
                    }, 50); // Emit every 50ms
                }
            }
        } else if (whiteboardTool === 'eraser') {
            setEraserPath((prev) => [...prev, [x, y]]);
            // Erase strokes that intersect with eraser path
            const eraserRadius = whiteboardSize * 2;
            const updatedStrokes = whiteboardStrokes.filter(stroke => {
                return !stroke.points.some(([sx, sy]) => {
                    return [...eraserPath, [x, y]].some(([ex, ey]) => (
                        Math.sqrt((sx - ex) ** 2 + (sy - ey) ** 2) < eraserRadius
                    ));
                });
            });

            if (updatedStrokes.length !== whiteboardStrokes.length) {
                // Find which ones were removed
                const removedStrokes = whiteboardStrokes.filter(s => !updatedStrokes.some(us => us.id === s.id));
                removedStrokes.forEach(s => {
                    if (meeting?.id) emitWhiteboardDraw(meeting.id, { type: 'erase', id: s.id });
                });

                setWhiteboardStrokes(updatedStrokes);
            }
        }
    };

    const handlePointerUp = () => {
        setWhiteboardDrawing(false);
        setEraserPath([]);
        setCurrentStrokeId(null);
    };

    // Canvas redraw logic
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        // Set actual size in memory (scaled to extra pixels)
        canvas.width = canvasDims.w * dpr;
        canvas.height = canvasDims.h * dpr;

        // Normalize coordinate system to logical pixels
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, canvasDims.w, canvasDims.h);
        whiteboardStrokes.forEach(stroke => {
            ctx.strokeStyle = stroke.tool === 'pen' ? stroke.color : '#fff';
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            stroke.points.forEach(([x, y], i) => {
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
    }, [whiteboardStrokes, canvasDims, whiteboardTool, isWhiteboardOpen]);

    // Resize canvas on open and window resize
    useEffect(() => {
        if (!isWhiteboardOpen) return;
        const updateDims = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setCanvasDims({ w, h });
        };
        updateDims();
        window.addEventListener('resize', updateDims);
        return () => window.removeEventListener('resize', updateDims);
    }, [isWhiteboardOpen]);

    // Resize canvas on open

    useEffect(() => {
        function handleEsc(e: KeyboardEvent) {
            if (e.key === 'Escape' && showReactions) toggleReactions();
        }
        function handleDocClick(e: MouseEvent) {
            // ...existing code or leave empty if not needed...
        }
        document.addEventListener('keydown', handleEsc);
        document.addEventListener('mousedown', handleDocClick);
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.removeEventListener('mousedown', handleDocClick);
        };
    }, [showReactions]);

    // Recording Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Derived state
    // isHost is now defined at the top of ControlBar from isJoinedAsHost

    // Handlers
    const handleReaction = (emoji: string) => {
        const reaction: Reaction = {
            id: `reaction-${Date.now()}`,
            participantId: user?.id || 'unknown',
            emoji,
            timestamp: new Date()
        };
        addReaction(reaction);
        toggleReactions();
    };

    const handleAudioToggle = () => {
        if (!micAllowed) {
            import('sonner').then(({ toast }) => toast.error('Host has disabled microphones for participants.'));
            return;
        }
        setMicConfirm(true);
    };

    const confirmAudioToggle = async () => {
        setMicConfirm(false);
        const currentIsMuted = isAudioMuted;
        const currentStream = useMeetingStore.getState().localStream;

        // Check if any audio tracks are 'ended'
        const hasEndedTrack = currentStream?.getAudioTracks().some(t => t.readyState === 'ended');

        // If we are unmuting and have no active stream or ended track, try to get it here (user gesture)
        if (currentIsMuted && (!currentStream || !currentStream.active || currentStream.getAudioTracks().length === 0 || hasEndedTrack)) {
            try {
                console.log("Requesting audio stream on user gesture...");
                const isVideoOff = useMeetingStore.getState().isVideoOff;
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: !isVideoOff
                });

                setLocalStream(stream);
            } catch (err) {
                console.error("Failed to get audio stream on toggle:", err);
            }
        }

        toggleAudio();
        const userId = user?.id;
        const participant = participants.find(p => p.id === userId)
            || participants.find(p => p.id === `participant-${userId}`)
            || participants.find(p => p.id === 'participant-1');

        if (participant) {
            const nextMuted = !currentIsMuted;
            updateParticipant(participant.id, { isAudioMuted: nextMuted });

            // Broadcast update to others
            const { meetingId, emitParticipantUpdate } = useChatStore.getState();
            if (meetingId) {
                emitParticipantUpdate(meetingId, participant.id, { isAudioMuted: nextMuted });
            }
        }
    };

    const handleVideoToggle = () => {
        if (!videoAllowed) {
            import('sonner').then(({ toast }) => toast.error("The host has disabled video for participants."));
            return;
        }
        setVideoConfirm(true);
    };

    const confirmVideoToggle = async () => {
        setVideoConfirm(false);
        const currentIsVideoOff = isVideoOff;
        const currentStream = useMeetingStore.getState().localStream;

        // Check if any video tracks are 'ended'
        const hasEndedTrack = currentStream?.getVideoTracks().some(t => t.readyState === 'ended');

        // If we are turning video ON and have no active video track or ended track, try to get it here (user gesture)
        if (currentIsVideoOff && (!currentStream || !currentStream.active || currentStream.getVideoTracks().length === 0 || hasEndedTrack)) {
            try {
                console.log("Requesting video stream on user gesture...");
                const isAudioMutedCurrent = useMeetingStore.getState().isAudioMuted;
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: !isAudioMutedCurrent
                });
                setLocalStream(stream);
            } catch (err) {
                console.error("Failed to get video stream on toggle:", err);
            }
        }

        toggleVideo();
        const userId = user?.id;
        const participant = participants.find(p => p.id === userId)
            || participants.find(p => p.id === `participant-${userId}`)
            || participants.find(p => p.id === 'participant-1');

        if (participant) {
            const nextVideoOff = !currentIsVideoOff;
            updateParticipant(participant.id, { isVideoOff: nextVideoOff });

            // Broadcast update to others
            const { meetingId, emitParticipantUpdate } = useChatStore.getState();
            if (meetingId) {
                emitParticipantUpdate(meetingId, participant.id, { isVideoOff: nextVideoOff });
            }
        }
    };

    // Centralized Stop Sharing
    const handleStopScreenShare = () => {
        // 1. Get current stream from store or ref if needed (store is best source of truth)
        const currentStream = useMeetingStore.getState().screenShareStream;

        // 2. Stop all tracks securely
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        // 3. Update Store State
        setScreenShareStream(null);
        if (useMeetingStore.getState().isScreenSharing) {
            toggleScreenShare(); // Turn off
        }

        // 4. Broadcast update to others
        if (meeting?.id && user?.id) {
            emitParticipantUpdate(meeting.id, user.id, { isScreenSharing: false });
        }
    };

    const handleShareClick = () => {
        if (isScreenSharing) {
            handleStopScreenShare();
        } else {
            if (!screenShareAllowed) {
                import('sonner').then(({ toast }) => toast.error('Host has disabled screen sharing for participants.'));
                return;
            }
            // Direct start - bypassing intermediate modal
            handleStartScreenShare();
        }
    };

    const handleStartScreenShare = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                alert("Screen sharing is not supported in this browser.");
                return;
            }

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'monitor' // Hint to browser to default to entire screen
                } as MediaTrackConstraints,
                audio: true
            });

            // 1. Set stream immediately
            setScreenShareStream(stream);

            // 2. Set state if not already
            if (!useMeetingStore.getState().isScreenSharing) {
                toggleScreenShare();
            }

            setShowScreenShareOptions(false);

            // 3. Handle external stop (e.g. browser UI "Stop Sharing" button)
            stream.getVideoTracks()[0].onended = () => {
                handleStopScreenShare();
            };

            // 4. Broadcast update to others
            if (meeting?.id && user?.id) {
                emitParticipantUpdate(meeting.id, user.id, {
                    isScreenSharing: true,
                    screenShareStreamId: stream.id
                });
            }

        } catch (err) {
            console.error("Error sharing screen:", err);
        }
    };

    // Copy meeting link to clipboard (falls back to alert with the link)
    const handleCopyMeetingLink = async (e?: React.MouseEvent) => {
        // Prevent event from bubbling up and closing the dropdown
        if (e) {
            e.stopPropagation();
        }

        const link = meeting?.id ? `${window.location.origin}/join/${meeting.id}` : window.location.href;

        try {
            await navigator.clipboard.writeText(link);
            setCopiedMeetingLink(true);
            setTimeout(() => setCopiedMeetingLink(false), 2000);

            // Show toast notification
            import('sonner').then(({ toast }) => {
                toast.success('Meeting link copied!', {
                    description: 'Share this link with participants',
                    duration: 3000,
                    position: 'top-center'
                });
            });
        } catch (err) {
            console.error('Clipboard API failed, trying fallback', err);
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = link;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            textArea.style.top = '0';
            textArea.style.left = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    setCopiedMeetingLink(true);
                    setTimeout(() => setCopiedMeetingLink(false), 2000);
                    import('sonner').then(({ toast }) => {
                        toast.success('Meeting link copied!', {
                            description: 'Share this link with participants',
                            duration: 3000,
                            position: 'top-center'
                        });
                    });
                } else {
                    throw new Error('execCommand failed');
                }
            } catch (e) {
                console.error('Fallback copy failed', e);
                import('sonner').then(({ toast }) => {
                    toast.error('Failed to copy link', {
                        description: 'Please copy manually',
                        duration: 3000,
                        position: 'top-center'
                    });
                });
            }
            document.body.removeChild(textArea);
        }
    };

    const handleToggleValidRecording = async () => {
        if (isRecording) {
            // Stop Recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            toggleRecording();
            setRecordingStartTime(null);
        } else {
            // Start Recording
            try {
                if (typeof MediaRecorder === 'undefined') {
                    alert("Media recording is not supported in this browser.");
                    return;
                }

                // Check if both mic and camera are on
                if (isAudioMuted || isVideoOff) {
                    alert("Please turn ON both your camera and microphone to start recording.");
                    return;
                }

                // Use local stream (User Camera) to start instantly without Browser Picker Dialog
                const stream = useMeetingStore.getState().localStream;

                if (!stream) {
                    console.error("No local camera stream available to record.");
                    alert("Unable to access camera or microphone stream.");
                    return;
                }

                // Check for supported mime types
                const types = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm',
                    'video/mp4',
                ];

                const supportedType = types.find(type => MediaRecorder.isTypeSupported(type));

                if (!supportedType) {
                    console.error("No supported mime type found for MediaRecorder");
                    alert("Recording is not supported on this browser.");
                    return;
                }

                console.log(`Starting recording with type: ${supportedType}`);
                const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
                mediaRecorderRef.current = mediaRecorder;
                chunksRef.current = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunksRef.current.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const extension = supportedType.includes('video/mp4') ? 'mp4' : 'webm';
                    const blob = new Blob(chunksRef.current, { type: supportedType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `recording-${new Date().toISOString()}.${extension}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);

                    // NOTE: Do NOT stop tracks here, as this is the live camera stream.
                };

                mediaRecorder.start();
                toggleRecording();
                setRecordingStartTime(Date.now());

            } catch (err) {
                console.error("Error starting recording:", err);
                alert(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    };

    const handleLeave = async (endForAll = false) => {
        console.log('MeetingControls: handleLeave called', { isHost, endForAll, role: currentParticipant?.role, meetingHostId: meeting?.hostId, userId: user?.id });

        if (isHost && meeting) {
            // If host ending for all, emit socket event
            if (endForAll) {
                useChatStore.getState().endMeeting(meeting.id);
            }

            try {
                const { summaryPoints, actionItems } = useAIStore.getState();
                const { messages: transcript } = useChatStore.getState();

                const formatTime = (date: Date) => {
                    const h = String(date.getHours()).padStart(2, '0');
                    const m = String(date.getMinutes()).padStart(2, '0');
                    return `${h}:${m}`;
                };

                const recapData = {
                    id: meeting.id,
                    title: meeting.title,
                    date: new Date().toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }),
                    time: (() => {
                        if (meeting.start_timestamp) return formatTime(new Date(Number(meeting.start_timestamp)));
                        if (meeting.startTime) {
                            const st = meeting.startTime as any;
                            const d = new Date(typeof st === 'string' && !st.endsWith('Z') && !st.includes('+') ? (st.includes(' ') ? st.replace(' ', 'T') + 'Z' : st + 'Z') : st);
                            return formatTime(d);
                        }
                        return formatTime(new Date());
                    })(),
                    timestamp: Date.now(),
                    host: participants.find(p => p.id === meeting.hostId)?.name || user?.name || 'Host',
                    duration: meeting.startTime ? Math.floor((Date.now() - new Date(meeting.startTime).getTime()) / 60000) + ' min' : '---',
                    participants: participants.map(p => p.name),
                    summary: summaryPoints,
                    actionItems: actionItems,
                    transcript: transcript.map(m => ({
                        speaker: m.senderName,
                        text: m.content,
                        time: formatTime(new Date(m.timestamp))
                    }))
                };

                console.log('Saving meeting recap...', recapData);

                // Fire and forget (or await if we want to be sure)
                const API = import.meta.env.VITE_API_URL || '';
                const response = await fetch(`${API}/api/recaps`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(recapData)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Server responded with ${response.status}: ${errorData.error || 'Unknown error'}`);
                }

                console.log('Meeting recap saved successfully');
            } catch (err) {
                console.error('Failed to save meeting recap:', err);
            }
        }

        leaveMeeting();
        navigate('/');
    };

    // Helper for checking subscription
    const handleExtendMeeting = (minutes: number) => {
        if (!user || !user.subscriptionPlan || user.subscriptionPlan === 'free') {
            setShowUpgradeModal(true);
            return;
        }
        extendMeetingTime(minutes);
    };

    // Keyboard Shortcuts (Alt + Letter)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!e.altKey) return;

            const key = e.key.toLowerCase();

            // Don't trigger if user is typing in an input/textarea
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            switch (key) {
                case 'a':
                    e.preventDefault();
                    handleAudioToggle();
                    break;
                case 'v':
                    e.preventDefault();
                    handleVideoToggle();
                    break;
                case 's':
                    e.preventDefault();
                    handleShareClick();
                    break;
                case 'd':
                    e.preventDefault();
                    handleToggleValidRecording();
                    break;
                case 'c':
                    e.preventDefault();
                    toggleChat();
                    break;
                case 'p':
                    e.preventDefault();
                    toggleParticipants();
                    break;
                case 'r':
                    e.preventDefault();
                    toggleReactions();
                    break;
                case 'h':
                    e.preventDefault();
                    handleToggleHand();
                    break;
                case 'w':
                    e.preventDefault();
                    if (isWhiteboardOpen) closeWhiteboard();
                    else openWhiteboard();
                    break;
                case 'i':
                    e.preventDefault();
                    toggleAICompanion();
                    break;
                case 'g':
                    e.preventDefault();
                    setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery');
                    break;
                case 't':
                    e.preventDefault();
                    toggleSettings();
                    break;
                case 'o':
                    e.preventDefault();
                    toggleSelfView();
                    break;
                case 'l':
                    e.preventDefault();
                    handleLeave();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        isAudioMuted, isVideoOff, isScreenSharing, isRecording, isChatOpen,
        isParticipantsOpen, showReactions, isWhiteboardOpen, isAICompanionOpen,
        viewMode, showSelfView, handleAudioToggle, handleVideoToggle, handleShareClick,
        handleToggleValidRecording, toggleChat, toggleParticipants, toggleReactions,
        handleToggleHand, toggleAICompanion, setViewMode, toggleSettings, toggleSelfView,
        handleLeave
    ]);

    return (
        <>
            {/* Bottom Control Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-[#333] z-40 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] px-4 shadow-2xl">
                <div className="flex items-center justify-between max-w-screen-2xl mx-auto">

                    {/* Main Controls - Center Aligned */}
                    <div className="flex items-center gap-4 md:gap-3 lg:gap-4 flex-1 justify-start md:justify-center overflow-x-auto no-scrollbar pb-1 px-2">

                        {/* Audio */}
                        <DropdownMenu>
                            <div className="flex-none flex items-center bg-[#1A1A1A] rounded-md overflow-hidden hover:bg-[#2A2A2A] transition-colors border border-transparent hover:border-[#444]">
                                <button
                                    onClick={handleAudioToggle}
                                    className={cn(
                                        "flex flex-col items-center justify-center w-14 h-14 px-1 py-1 gap-1 outline-none",
                                        isAudioMuted && "text-red-500",
                                        !micAllowed && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {!micAllowed ? (
                                        <Lock className="w-5 h-5 text-gray-500" />
                                    ) : (
                                        isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />
                                    )}
                                    <span className="text-[10px] sm:text-[11px] font-medium text-gray-300">
                                        {isAudioMuted ? 'Unmute' : 'Mute'}
                                    </span>
                                </button>
                                <DropdownMenuTrigger asChild>
                                    <button className="h-14 px-1 hover:bg-[#3A3A3A] transition-colors flex items-start pt-2">
                                        <ChevronUp className="w-3 h-3 text-gray-400" />
                                    </button>
                                </DropdownMenuTrigger>
                            </div>
                            <DropdownMenuContent className="bg-[#1A1A1A] border-[#333] text-gray-200">
                                <DropdownMenuLabel>Select a Microphone</DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={() => setAudioDevice('default')}
                                    className={cn("cursor-pointer", selectedAudioId === 'default' && "bg-[#2A2A2A] text-blue-400")}
                                >
                                    Default Microphone
                                    {selectedAudioId === 'default' && <Check className="w-4 h-4 ml-auto" />}
                                </DropdownMenuItem>
                                {audioDevices.map((device) => (
                                    <DropdownMenuItem
                                        key={device.deviceId}
                                        onClick={() => setAudioDevice(device.deviceId)}
                                        className={cn("cursor-pointer", selectedAudioId === device.deviceId && "bg-[#2A2A2A] text-blue-400")}
                                    >
                                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                        {selectedAudioId === device.deviceId && <Check className="w-4 h-4 ml-auto" />}
                                    </DropdownMenuItem>
                                ))}

                                <DropdownMenuSeparator className="bg-[#333]" />
                                <DropdownMenuLabel>Select a Speaker</DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={() => setSpeakerDevice('default')}
                                    className={cn("cursor-pointer", selectedSpeakerId === 'default' && "bg-[#2A2A2A] text-blue-400")}
                                >
                                    Default Speaker
                                    {selectedSpeakerId === 'default' && <Check className="w-4 h-4 ml-auto" />}
                                </DropdownMenuItem>
                                {speakerDevices.map((device) => (
                                    <DropdownMenuItem
                                        key={device.deviceId}
                                        onClick={() => setSpeakerDevice(device.deviceId)}
                                        className={cn("cursor-pointer", selectedSpeakerId === device.deviceId && "bg-[#2A2A2A] text-blue-400")}
                                    >
                                        {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                                        {selectedSpeakerId === device.deviceId && <Check className="w-4 h-4 ml-auto" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Video */}
                        <DropdownMenu>
                            <div className={cn(
                                "flex-none flex items-center bg-[#1A1A1A] rounded-md overflow-hidden transition-colors border border-transparent",
                                videoAllowed ? "hover:bg-[#2A2A2A] hover:border-[#444]" : "opacity-50 cursor-not-allowed"
                            )}>
                                <button
                                    onClick={handleVideoToggle}
                                    disabled={!videoAllowed}
                                    className={cn(
                                        "flex flex-col items-center justify-center w-14 h-14 px-1 py-1 gap-1 outline-none",
                                        isVideoOff && "text-red-500",
                                        !videoAllowed && "text-gray-500"
                                    )}
                                >
                                    {!videoAllowed ? (
                                        <Lock className="w-5 h-5" />
                                    ) : (
                                        isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />
                                    )}
                                    <span className="text-[10px] sm:text-[11px] font-medium text-gray-300">
                                        Video
                                    </span>
                                </button>
                                <DropdownMenuTrigger asChild disabled={!videoAllowed}>
                                    <button disabled={!videoAllowed} className="h-14 px-1 hover:bg-[#3A3A3A] transition-colors flex items-start pt-2">
                                        <ChevronUp className="w-3 h-3 text-gray-400" />
                                    </button>
                                </DropdownMenuTrigger>
                            </div>
                            <DropdownMenuContent className="bg-[#1A1A1A] border-[#333] text-gray-200">
                                <DropdownMenuLabel>Select a Camera</DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={() => setVideoDevice('default')}
                                    className={cn("cursor-pointer", selectedVideoId === 'default' && "bg-[#2A2A2A] text-blue-400")}
                                >
                                    Default Camera
                                    {selectedVideoId === 'default' && <Check className="w-4 h-4 ml-auto" />}
                                </DropdownMenuItem>
                                {videoDevices.map((device) => (
                                    <DropdownMenuItem
                                        key={device.deviceId}
                                        onClick={() => setVideoDevice(device.deviceId)}
                                        className={cn("cursor-pointer", selectedVideoId === device.deviceId && "bg-[#2A2A2A] text-blue-400")}
                                    >
                                        {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                                        {selectedVideoId === device.deviceId && <Check className="w-4 h-4 ml-auto" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Participants */}
                        <ControlButton
                            icon={Users}
                            label="Participants"
                            onClick={toggleParticipants}
                            isActiveState={isParticipantsOpen}
                            badge={participants.length}
                        />

                        {/* Chat */}
                        <ControlButton
                            icon={MessageSquare}
                            label="Chat"
                            onClick={toggleChat}
                            isActiveState={isChatOpen}
                            badge={displayUnreadCount}
                        />

                        {/* Reactions Button */}
                        <ControlButton
                            icon={Smile}
                            label="Reactions"
                            onClick={toggleReactions}
                        />

                        {/* 🔥 INLINE REACTIONS STRIP (NOT A POPUP) */}
                        <AnimatePresence>
                            {showReactions && (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 12 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                    className="
                    fixed
                    bottom-[80px]
                    left-0
                    right-0
                    z-40
                    flex
                    justify-center
                    gap-4
                    py-2
                  "
                                >
                                    {reactionEmojis.map((emoji) => (
                                        <button
                                            key={emoji}
                                            onClick={() => handleReaction(emoji)}
                                            className="text-2xl hover:scale-125 transition-transform"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Share Screen */}
                        <DropdownMenu>
                            <div className="relative flex-none">
                                <DropdownMenuTrigger asChild>
                                    <div className={cn(
                                        "group flex flex-col items-center gap-1 cursor-pointer min-w-[3.5rem]",
                                        !screenShareAllowed && "opacity-50 cursor-not-allowed"
                                    )}
                                        onClick={() => {
                                            if (!screenShareAllowed) {
                                                import('sonner').then(({ toast }) => toast.error('Host has disabled screen sharing.'));
                                            }
                                        }}>
                                        <div className={cn(
                                            "relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                                            "hover:bg-[#333] text-gray-200"
                                        )}>
                                            {!screenShareAllowed ? <Lock className="w-5 h-5 text-gray-500" /> : <Share2 className="w-5 h-5" strokeWidth={2} />}
                                            <div className="absolute top-0 right-0 -mr-1">
                                                <ChevronUp className="w-3 h-3 text-gray-400 group-hover:text-white" />
                                            </div>
                                        </div>
                                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 group-hover:text-white whitespace-nowrap">
                                            Share Screen
                                        </span>
                                    </div>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent className="bg-[#1A1A1A] border-[#333] text-gray-200 w-64">
                                    <DropdownMenuLabel>Sharing Options</DropdownMenuLabel>

                                    {/* Copy meeting link */}
                                    <DropdownMenuItem onClick={handleCopyMeetingLink} className="cursor-pointer flex items-center justify-between">
                                        <span className="flex-1">Share Meeting Link</span>
                                        {copiedMeetingLink ? (
                                            <span className="text-xs text-green-400 font-semibold">Copied</span>
                                        ) : (
                                            <span className="text-xs text-gray-400">Copy</span>
                                        )}
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-[#333]" />
                                    <DropdownMenuItem onClick={handleShareClick} className="cursor-pointer">
                                        <span className="flex-1">Share Screen / Window</span>
                                        {isScreenSharing && <Check className="w-4 h-4 text-green-500" />}
                                    </DropdownMenuItem>
                                    {isScreenSharing && (
                                        <DropdownMenuItem onClick={handleStopScreenShare} className="cursor-pointer text-red-400">
                                            Stop Sharing
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator className="bg-[#333]" />
                                    <DropdownMenuItem disabled>
                                        Multiple participants can share simultaneously
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled>
                                        Advanced sharing options...
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </div>
                        </DropdownMenu>

                        {/* Record Button */}
                        <ControlButton
                            icon={Circle}
                            label={isRecording ? "Stop Recording" : "Record"}
                            onClick={handleToggleValidRecording}
                            active={isRecording}
                            className={isRecording ? "text-red-500" : ""}
                        />

                        {/* Fullscreen Button */}
                        <ControlButton
                            icon={isFullscreen ? Minimize2 : Maximize2}
                            label="Fullscreen"
                            onClick={toggleFullscreen}
                        />

                        {/* More */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <div className="outline-none flex-none">
                                    <ControlButton
                                        icon={MoreVertical}
                                        label="More"
                                        onClick={() => { }}
                                        isActiveState={isHandRaised}
                                    />
                                </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="bg-[#18181b] border-[#333] text-gray-200 w-56 shadow-xl rounded-lg">
                                {canEditWhiteboard && (
                                    <DropdownMenuItem onClick={openWhiteboard} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                        <Grid3x3 className="w-4 h-4 mr-2" />
                                        Whiteboard
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={toggleAICompanion} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    AI Companion
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleToggleHand} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                    <Hand className={cn("w-4 h-4 mr-2", isHandRaised ? 'text-yellow-400' : '')} />
                                    {isHandRaised ? 'Lower Hand' : 'Raise Hand'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery')} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                    {viewMode === 'gallery' ? <User className="w-4 h-4 mr-2" /> : <Grid3x3 className="w-4 h-4 mr-2" />}
                                    {viewMode === 'gallery' ? 'Speaker View' : 'Gallery View'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={toggleSelfView} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                    {showSelfView ? <Check className="w-4 h-4 mr-2" /> : <div className="w-4 h-4 mr-2" />}
                                    Show Self View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={toggleSettings} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </DropdownMenuItem>
                                {isHost && !isSubscribed && (
                                    <DropdownMenuItem onClick={() => setShowUpgradeModal(true)} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Extend Meeting
                                    </DropdownMenuItem>
                                )}
                                {isHost && isSubscribed && (
                                    <DropdownMenuItem onClick={() => handleExtendMeeting(15)} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Extend Meeting +15 min
                                    </DropdownMenuItem>
                                )}
                                {isHost && isSubscribed && (
                                    <DropdownMenuItem onClick={() => handleExtendMeeting(30)} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Extend Meeting +30 min
                                    </DropdownMenuItem>
                                )}
                                {isHost && isSubscribed && (
                                    <DropdownMenuItem onClick={() => handleExtendMeeting(60)} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Extend Meeting +60 min
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Whiteboard Overlay (must be outside DropdownMenuContent) */}
                        {isWhiteboardOpen && (
                            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white">
                                {/* Controls overlay: ensure z-index and pointer-events */}
                                <div className={cn(
                                    "absolute top-0 left-0 w-full flex items-center justify-between z-[102] bg-white border-b px-6 py-4",
                                    isMobile ? "px-4 py-3 border-gray-200" : "bg-white/90 border-[#e5e7eb]"
                                )} style={{ pointerEvents: 'auto' }}>

                                    {/* Left Side: Title & Permissions Dropdown */}
                                    <div className="flex items-center gap-4">
                                        <span className={cn("font-bold text-gray-900", isMobile ? "text-xl" : "text-lg")}>
                                            Whiteboard
                                        </span>

                                        {isHost && (
                                            <select
                                                value={whiteboardEditAccess}
                                                onChange={(e) => setWhiteboardEditAccess(e.target.value as any)}
                                                className="bg-gray-100 border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor:pointer hover:bg-gray-200 transition-colors"
                                            >
                                                <option value="hostOnly">Only Host</option>
                                                <option value="coHost">Host + Co-host</option>
                                                <option value="everyone">Everyone</option>
                                            </select>
                                        )}
                                    </div>

                                    {/* Right Side: Lock Icon & Close Button */}
                                    {/* Right Side: Lock Icon & Close Button */}
                                    <div className="flex items-center gap-3">
                                        {/* Meeting Info Dropdown (Duplicate for Whiteboard Context) */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <div className="bg-green-500 rounded-full p-2 flex items-center justify-center shadow-lg cursor-pointer hover:bg-green-600 transition-colors">
                                                    <Lock className="w-4 h-4 text-white" />
                                                </div>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                sideOffset={10}
                                                className="w-[320px] bg-[#1C1C1C] border-[#333] text-white p-0 shadow-xl overflow-hidden pointer-events-auto z-[200]"
                                            >
                                                <div className="p-4 border-b border-[#333]">
                                                    <h3 className="font-semibold text-lg">{meeting?.title || 'Meeting Topic'}</h3>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Hosted by {participants.find(p => p.id === meeting?.hostId)?.name || 'Host'}
                                                    </p>
                                                </div>

                                                <div className="p-4 space-y-4">
                                                    {/* Meeting ID */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-gray-400">Meeting ID</span>
                                                        <span className="text-sm font-medium">{meeting?.id || '--- --- ---'}</span>
                                                    </div>

                                                    {/* Host */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-gray-400">Host</span>
                                                        <span className="text-sm font-medium">{participants.find(p => p.id === meeting?.hostId)?.name || 'Host'}</span>
                                                    </div>

                                                    {/* Passcode */}
                                                    {meeting?.password && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-gray-400">Passcode</span>
                                                            <span className="text-sm font-medium">{meeting.password}</span>
                                                        </div>
                                                    )}

                                                    {/* Invite Link */}
                                                    <div className="space-y-2">
                                                        <span className="text-sm text-gray-400">Invite Link</span>
                                                        <div className="flex items-center gap-2 bg-[#2A2A2A] rounded p-2">
                                                            <span className="text-xs text-gray-300 truncate flex-1 select-all">
                                                                {meeting?.id ? `${window.location.origin}/join/${meeting.id}` : window.location.href}
                                                            </span>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-6 w-6 hover:bg-[#3A3A3A] hover:text-white"
                                                                onClick={handleCopyMeetingLink}
                                                            >
                                                                {copiedMeetingLink ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                            </Button>
                                                        </div>
                                                        <div
                                                            className="flex items-center gap-2 text-blue-400 cursor-pointer hover:underline text-sm mt-1"
                                                            onClick={handleCopyMeetingLink}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                            <span>Copy Link</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* Close Button */}
                                        <button
                                            type="button"
                                            onClick={() => { closeWhiteboard(); }}
                                            className="text-gray-500 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors z-[110] relative"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>

                                {canEditWhiteboard && (
                                    <div
                                        className={cn(
                                            "absolute left-1/2 -translate-x-1/2 z-[102] bg-white rounded-xl border border-gray-200 shadow-xl flex items-center gap-4 transition-all",
                                            isMobile ? "top-16 max-w-[95vw] overflow-x-auto no-scrollbar scroll-smooth p-2" : "top-20 px-4 py-2"
                                        )}
                                        style={{ pointerEvents: 'auto' }}
                                    >
                                        <div className={cn("flex items-center gap-4", isMobile ? "min-w-max px-2" : "")}>
                                            {/* Pen/Eraser toggle */}
                                            <div className="flex bg-gray-100 p-1 rounded-lg flex-none">
                                                <button
                                                    onClick={() => setWhiteboardTool('pen')}
                                                    className={cn(
                                                        "px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                                                        whiteboardTool === 'pen' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                                                    )}
                                                >
                                                    Pen
                                                </button>
                                                <button
                                                    onClick={() => setWhiteboardTool('eraser')}
                                                    className={cn(
                                                        "px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                                                        whiteboardTool === 'eraser' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                                                    )}
                                                >
                                                    Eraser
                                                </button>
                                            </div>
                                            <div className="w-px h-6 bg-gray-200 flex-none" />
                                            {/* Color picker */}
                                            <div className="flex gap-2 items-center flex-none">
                                                {['#111111', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setWhiteboardColor(c)}
                                                        className={cn(
                                                            "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex-none",
                                                            whiteboardColor === c ? 'border-blue-500 scale-110' : 'border-transparent'
                                                        )}
                                                        style={{ background: c }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="w-px h-6 bg-gray-200 flex-none" />
                                            {/* Size picker */}
                                            <div className="flex items-center gap-2 flex-none">
                                                <select
                                                    value={whiteboardSize}
                                                    onChange={e => setWhiteboardSize(Number(e.target.value))}
                                                    className="bg-gray-50 text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    {[2, 4, 8, 12, 16].map(s => <option key={s} value={s}>{s}px</option>)}
                                                </select>
                                            </div>
                                            <div className="w-px h-6 bg-gray-200 flex-none" />

                                            {/* Undo / Redo */}
                                            <div className="flex items-center gap-1 flex-none">
                                                <button
                                                    onClick={handleUndo}
                                                    disabled={whiteboardStrokes.length === 0}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-colors",
                                                        whiteboardStrokes.length === 0 ? "text-gray-300 pointer-events-none" : "text-gray-600 hover:bg-gray-100"
                                                    )}
                                                    title="Undo (Ctrl+Z)"
                                                >
                                                    <Undo className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={handleRedo}
                                                    disabled={whiteboardRedoStack.length === 0}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-colors",
                                                        whiteboardRedoStack.length === 0 ? "text-gray-300 pointer-events-none" : "text-gray-600 hover:bg-gray-100"
                                                    )}
                                                    title="Redo (Ctrl+Y)"
                                                >
                                                    <Redo className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <div className="w-px h-6 bg-gray-200 flex-none" />

                                            {/* Export */}
                                            <button
                                                onClick={handleExportImage}
                                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-none"
                                                title="Save as Image"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>

                                            <div className="w-px h-6 bg-gray-200 flex-none" />
                                            <button
                                                type="button"
                                                onClick={() => { clearWhiteboard(); }}
                                                className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-bold flex-none"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Canvas: ensure controls overlay is above canvas */}
                                <canvas
                                    ref={canvasRef}
                                    className={cn(
                                        "absolute inset-0 w-full h-full z-[101]",
                                        canEditWhiteboard ? "cursor-crosshair" : "cursor-default"
                                    )}
                                    style={{
                                        zIndex: 101,
                                        pointerEvents: 'auto',
                                        touchAction: 'none'
                                    }}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerLeave={handlePointerUp}
                                />
                            </div>
                        )}

                    </div>

                    {/* End Button - Far Right */}
                    <div className="flex-none ml-4">
                        <Button
                            onClick={() => setShowLeaveConfirm(true)}
                            className="bg-[#E53935] hover:bg-[#D32F2F] text-white font-semibold rounded-lg px-4 py-1.5 h-auto text-sm"
                        >
                            End
                        </Button>
                    </div>

                </div>
            </div>

            <SubscriptionModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />

            <ShareScreenModal
                open={showShareModal}
                onOpenChange={setShowShareModal}
                onConfirm={handleStartScreenShare}
            />

            {/* Leave Confirmation Modal */}
            <AnimatePresence>
                {showLeaveConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                        onClick={() => setShowLeaveConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#232323] border border-[#333] rounded-xl p-6 max-w-sm w-full shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-white mb-2">End Meeting?</h3>
                            <p className="text-gray-400 mb-6">
                                Are you sure you want to end or leave this meeting?
                            </p>
                            <div className="flex flex-col gap-3">
                                {isHost && (
                                    <Button
                                        onClick={() => handleLeave(true)}
                                        className="w-full bg-[#E53935] hover:bg-[#D32F2F] text-white py-6"
                                    >
                                        End Meeting for All
                                    </Button>
                                )}
                                <Button
                                    onClick={() => handleLeave()}
                                    variant={isHost ? "secondary" : "destructive"}
                                    className={cn("w-full py-6", !isHost && "bg-[#E53935] hover:bg-[#D32F2F] text-white")}
                                >
                                    Leave Meeting
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowLeaveConfirm(false)}
                                    className="mt-2 text-gray-300 hover:text-white hover:bg-[#333]"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mic Confirmation Modal */}
            <AnimatePresence>
                {showMicConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                        onClick={() => setMicConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1C1C1C] border border-[#333] rounded-xl p-5 max-w-[320px] w-full shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-white mb-2">Microphone</h3>
                            <p className="text-gray-400 text-sm mb-6">
                                Are you sure you want to {isAudioMuted ? 'unmute' : 'mute'} your microphone?
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="ghost"
                                    onClick={() => setMicConfirm(false)}
                                    className="text-gray-300 hover:text-white hover:bg-[#333]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    ref={yesButtonRef}
                                    onClick={confirmAudioToggle}
                                    className="bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white px-6"
                                >
                                    Yes
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Video Confirmation Modal */}
            <AnimatePresence>
                {showVideoConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                        onClick={() => setVideoConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1C1C1C] border border-[#333] rounded-xl p-5 max-w-[320px] w-full shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-white mb-2">Camera</h3>
                            <p className="text-gray-400 text-sm mb-6">
                                Are you sure you want to {isVideoOff ? 'turn on' : 'turn off'} your camera?
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="ghost"
                                    onClick={() => setVideoConfirm(false)}
                                    className="text-gray-300 hover:text-white hover:bg-[#333]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    ref={yesButtonRef}
                                    onClick={confirmVideoToggle}
                                    className="bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white px-6"
                                >
                                    Yes
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    ); // End of ControlBar return
}

// Helper Component for consistent button styling
interface ControlButtonProps {
    icon: any;
    label: string;
    onClick: () => void;
    active?: boolean; // Toggled state (e.g. mute is red)
    isActiveState?: boolean; // Active UI state (e.g. panel open is blue)
    className?: string;
    badge?: number | string;
}

// Remove ref usage from ControlButton, ensure no ref is passed to function component
function ControlButton({ icon: Icon, label, onClick, active, isActiveState, className, badge }: ControlButtonProps) {
    return (
        <div
            className={cn("group flex flex-col items-center gap-1 cursor-pointer min-w-[3.5rem] flex-none", className)}
            onClick={onClick}
            tabIndex={0}
            role="button"
            aria-label={label}
        >
            <div className="relative">
                <div className={cn(
                    "relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                    isActiveState ? "bg-[#333] text-[#0B5CFF]" : "hover:bg-[#333] text-gray-200",
                    active && "text-red-500",
                    className
                )}>
                    <Icon className={cn("w-5 h-5", active && "fill-current")} strokeWidth={2} />
                    {badge !== undefined && (typeof badge === 'number' ? badge > 0 : badge.length > 0) && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
                            {badge}
                        </span>
                    )}
                </div>
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 group-hover:text-white whitespace-nowrap">
                {label}
            </span>
        </div>
    );
}

// This step is just to trigger a safe rebuild/refresh of the file content
// and confirm no syntax errors remain.
// I will not change anything significant, just force a save.
export default function MeetingControls() {
    const { enumerateDevices } = useMeetingStore();

    useEffect(() => {
        enumerateDevices();
    }, [enumerateDevices]);

    return (
        <>
            <TopBar />
            <SettingsModal />
            <ControlBar />
        </>
    );
}
