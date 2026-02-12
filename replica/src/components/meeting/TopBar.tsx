import { Info, Copy, Check, Lock, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useParticipantsStore } from '@/stores/useParticipantsStore';

export default function TopBar() {
    const { meeting, isRecording, connectionQuality } = useMeetingStore();
    const { participants } = useParticipantsStore();
    const [copied, setCopied] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

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

    // ... (rest of the helper functions)

    // Derive host name
    const host = participants.find(p => p.id === meeting?.hostId);
    const hostName = host ? host.name : 'Host';

    // Meeting Link
    const inviteLink = meeting?.id
        ? `${window.location.origin}/join/${meeting.id}`
        : window.location.href;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = inviteLink;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (e) {
                console.error('Fallback copy failed', e);
                window.prompt('Copy link:', inviteLink);
            }
            document.body.removeChild(textArea);
        }
    };

    return (
        <div className="absolute top-0 left-0 right-0 z-50 p-4 pointer-events-none flex justify-between items-start">
            {/* Meeting Info Dropdown (Left aligned) - Pointer events auto to allow interaction */}
            <div className="pointer-events-auto">
                <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer group hover:bg-black/60 backdrop-blur-sm rounded-lg p-1.5 border border-transparent hover:border-white/10 transition-all">
                            <div className="bg-green-500 rounded-full p-2">
                                <Lock className="w-4 h-4 text-white" />
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        sideOffset={10}
                        className="w-[320px] bg-[#1C1C1C] border-[#333] text-white p-0 shadow-xl overflow-hidden"
                    >
                        <div className="p-4 border-b border-[#333]">
                            <h3 className="font-semibold text-lg">{meeting?.title || 'Meeting Topic'}</h3>
                            <p className="text-xs text-gray-400 mt-1">
                                Hosted by {hostName}
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
                                <span className="text-sm font-medium">{hostName}</span>
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
                                        {inviteLink}
                                    </span>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 hover:bg-[#3A3A3A] hover:text-white"
                                        onClick={handleCopyLink}
                                    >
                                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                    </Button>
                                </div>
                                {/* Explicit Copy Link Button as per user description might be beneficial to be more visible */}
                                <div
                                    className="flex items-center gap-2 text-blue-400 cursor-pointer hover:underline text-sm mt-1"
                                    onClick={handleCopyLink}
                                >
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Link</span>
                                </div>
                            </div>
                        </div>


                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Indicators Area */}
            <div className="flex items-center gap-3">
                {/* Connection Indicator - Only show if poor or offline */}
                {(connectionQuality === 'poor' || connectionQuality === 'offline') && (
                    <div className={cn(
                        "bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-lg pointer-events-auto transition-all animate-pulse border-red-500/50"
                    )}>
                        {connectionQuality === 'offline' ? (
                            <WifiOff className="w-4 h-4 text-red-500" />
                        ) : (
                            <Wifi className={cn("w-4 h-4", getConnectionColor())} />
                        )}
                        <span className={cn("text-[10px] font-bold tracking-tight uppercase", getConnectionColor())}>
                            {getConnectionLabel()}
                        </span>
                    </div>
                )}

                {/* Recording Indicator - Synchronized with isRecording state */}
                {isRecording && (
                    <div className="bg-red-600/90 backdrop-blur text-white text-[10px] px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg animate-pulse pointer-events-auto">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        <span className="font-bold tracking-wider uppercase">REC</span>
                    </div>
                )}
            </div>
        </div>
    );
}
