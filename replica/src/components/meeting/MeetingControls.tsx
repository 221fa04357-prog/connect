import { useState, useRef, useEffect } from 'react'; // Re-trigger IDE

import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Info, Copy, Check, Lock, Wifi, WifiOff,
    Video, Mic, Monitor, Keyboard, X,
    MicOff, VideoOff, MessageSquare, Users, MoreVertical,
    Grid3x3, User, Settings, ChevronUp, Share2, Circle, Smile,
    Hand, Sparkles, Clock, Maximize2, Minimize2, StopCircle, MousePointer2
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
    const { meeting, isRecording, connectionQuality, isWhiteboardOpen } = useMeetingStore();
    const { participants } = useParticipantsStore();
    const [copied, setCopied] = useState(false);
    // Removed controlled state usage to fix closing issue

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
        <div className="absolute inset-0 z-50 pointer-events-none">
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

            <div className="absolute top-4 right-4 pointer-events-auto flex items-center gap-3">
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

                {isRecording && (
                    <div className="bg-red-600/90 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full" />
                        <span className="font-semibold tracking-wide uppercase">
                            REC
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- SettingsModal.tsx ---

function SettingsModal() {
    const { isSettingsOpen, toggleSettings } = useMeetingStore();
    const [settings, setSettings] = useState({
        audioInput: 'default',
        audioOutput: 'default',
        videoInput: 'default',
        virtualBackground: 'none',
        backgroundBlur: false,
        hd: true,
        mirrorVideo: true,
        autoMute: false,
        autoVideo: true
    });

    const handleSave = () => {
        toggleSettings();
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
                                        value={settings.audioInput}
                                        onValueChange={(value) => setSettings({ ...settings, audioInput: value })}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040]">
                                            <SelectItem value="default">Default Microphone</SelectItem>
                                            <SelectItem value="mic1">Built-in Microphone</SelectItem>
                                            <SelectItem value="mic2">External Microphone</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Speaker</Label>
                                    <Select
                                        value={settings.audioOutput}
                                        onValueChange={(value) => setSettings({ ...settings, audioOutput: value })}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040]">
                                            <SelectItem value="default">Default Speaker</SelectItem>
                                            <SelectItem value="speaker1">Built-in Speaker</SelectItem>
                                            <SelectItem value="speaker2">External Speaker</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <Label htmlFor="autoMute">Mute microphone when joining</Label>
                                    <Switch
                                        id="autoMute"
                                        checked={settings.autoMute}
                                        onCheckedChange={(checked) => setSettings({ ...settings, autoMute: checked })}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="video" className="p-6 m-0 space-y-6">
                                <div className="space-y-2">
                                    <Label>Camera</Label>
                                    <Select
                                        value={settings.videoInput}
                                        onValueChange={(value) => setSettings({ ...settings, videoInput: value })}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040]">
                                            <SelectItem value="default">Default Camera</SelectItem>
                                            <SelectItem value="cam1">Built-in Camera</SelectItem>
                                            <SelectItem value="cam2">External Camera</SelectItem>
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
                                        <SelectContent className="bg-[#232323] border-[#404040]">
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
                                                These settings will be applied to all your meetings
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Default View Mode</Label>
                                            <Select defaultValue="gallery">
                                                <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#232323] border-[#404040]">
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
                            className="bg-[#0B5CFF] hover:bg-blue-600 text-white px-6"
                        >
                            Save Changes
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

        // Mic & Video Confirm
        showMicConfirm,
        showVideoConfirm,
        setMicConfirm,
        setVideoConfirm,

        isJoinedAsHost

    } = useMeetingStore();
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
    const currentUserId = user?.id;
    const currentParticipant = participants.find(p => p.id === currentUserId)
        || participants.find(p => p.id === `participant-${currentUserId}`)
        || participants[0];

    const isHost = isJoinedAsHost || (currentParticipant && (transientRoles[currentParticipant.id] || currentParticipant.role)) === 'host';
    const isHandRaised = !!currentParticipant?.isHandRaised;

    const isHostOrCoHost = currentParticipant?.role === 'host' || currentParticipant?.role === 'co-host';
    const videoAllowed = isHostOrCoHost || currentParticipant?.isVideoAllowed !== false;

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
    const { unreadCount } = useChatStore();
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
    const [whiteboardStrokes, setWhiteboardStrokes] = useState<any[]>([]); // [{points, color, size, tool}]
    const [whiteboardDrawing, setWhiteboardDrawing] = useState(false);
    const [eraserPath, setEraserPath] = useState<number[][]>([]); // For eraser tool
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
    const isMobile = useIsMobile();

    // Chat Badge Logic
    const displayUnreadCount = !isChatOpen ? (unreadCount > 99 ? '99+' : unreadCount) : 0;

    // RBAC for Whiteboard
    const whiteboardEditAccess = meeting?.settings?.whiteboardEditAccess || 'hostOnly';
    const canEditWhiteboard =
        currentParticipant?.role === 'host' ||
        (whiteboardEditAccess === 'coHost' && currentParticipant?.role === 'co-host') ||
        (whiteboardEditAccess === 'everyone');

    // Whiteboard handlers
    const openWhiteboard = () => { if (!isWhiteboardOpen) toggleWhiteboard(); };
    const closeWhiteboard = () => {
        if (isWhiteboardOpen) toggleWhiteboard();
        setWhiteboardDrawing(false);
        setEraserPath([]);
    };
    const clearWhiteboard = () => {
        if (!canEditWhiteboard) return;
        setWhiteboardStrokes([]);
        setWhiteboardDrawing(false);
        setEraserPath([]);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    // Drawing logic (frontend only, no backend)
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!canEditWhiteboard) return;
        setWhiteboardDrawing(true);
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (whiteboardTool === 'pen') {
            setWhiteboardStrokes((prev) => [...prev, { points: [[x, y]], color: whiteboardColor, size: whiteboardSize, tool: 'pen' }]);
        } else if (whiteboardTool === 'eraser') {
            setEraserPath([[x, y]]);
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!whiteboardDrawing || !canEditWhiteboard) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (whiteboardTool === 'pen') {
            setWhiteboardStrokes((prev) => {
                if (!prev.length) return prev;
                const last = { ...prev[prev.length - 1] };
                last.points = [...last.points, [x, y]];
                return [...prev.slice(0, -1), last];
            });
        } else if (whiteboardTool === 'eraser') {
            setEraserPath((prev) => [...prev, [x, y]]);
            // Erase strokes that intersect with eraser path
            setWhiteboardStrokes((prev) => {
                const eraserRadius = whiteboardSize * 2;
                return prev.filter(stroke => {
                    // If any point in stroke is close to eraser path, remove stroke
                    return !stroke.points.some(([sx, sy]) => {
                        return eraserPath.some(([ex, ey]) => (
                            Math.sqrt((sx - ex) ** 2 + (sy - ey) ** 2) < eraserRadius
                        ));
                    });
                });
            });
        }
    };

    const handlePointerUp = () => {
        setWhiteboardDrawing(false);
        setEraserPath([]);
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
    }, [whiteboardStrokes, canvasDims, whiteboardTool]);

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
            alert("The host has disabled video for participants.");
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
    };

    const handleShareClick = () => {
        if (isScreenSharing) {
            handleStopScreenShare();
        } else {
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
                                        isAudioMuted && "text-red-500"
                                    )}
                                >
                                    {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
                                <DropdownMenuItem>Default - Microphone (Realtek)</DropdownMenuItem>
                                <DropdownMenuItem>Headset (Bluetooth)</DropdownMenuItem>
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
                                <DropdownMenuItem>Integrated Webcam</DropdownMenuItem>
                                <DropdownMenuItem>OBS Virtual Camera</DropdownMenuItem>
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
                                    <div className="group flex flex-col items-center gap-1 cursor-pointer min-w-[3.5rem]">
                                        <div className={cn(
                                            "relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                                            "hover:bg-[#333] text-gray-200"
                                        )}>
                                            <Share2 className="w-5 h-5" strokeWidth={2} />
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
                                <DropdownMenuItem onClick={openWhiteboard} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                                    <Grid3x3 className="w-4 h-4 mr-2" />
                                    Whiteboard
                                </DropdownMenuItem>
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
                                            className="text-gray-500 hover:text-gray-900 p-1 rounded-full hover:bg-gray-100 transition-colors"
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
                                            {isMobile && (
                                                <>
                                                    <div className="w-px h-6 bg-gray-200 flex-none" />
                                                    <button
                                                        type="button"
                                                        onClick={() => { clearWhiteboard(); }}
                                                        className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-bold flex-none"
                                                    >
                                                        Clear
                                                    </button>
                                                </>
                                            )}
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
                                        pointerEvents: canEditWhiteboard ? 'auto' : 'none',
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
    );
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

export default function MeetingControls() {
    return (
        <>
            <TopBar />
            <SettingsModal />
            <ControlBar />
        </>
    );
}
