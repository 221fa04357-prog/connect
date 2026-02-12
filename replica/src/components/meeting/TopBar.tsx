import { Info, Copy, Check, Lock, Wifi, WifiOff } from 'lucide-react';
import { useState, useRef, useEffect} from 'react';
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
    // Draggable State
    const [pos, setPos] = useState({ x: 16, y: 16 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const rafRef = useRef<number | null>(null);

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

    const handlePointerDown = (e: React.PointerEvent) => {
        // Only trigger drag on the lock icon, not when dropdown is clicking items (though items are not in trigger)
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
        <div className="fixed inset-0 z-50 pointer-events-none">
            {/* Meeting Info Dropdown - Fixed position makes it draggable anywhere */}
            <div
                className="absolute pointer-events-auto touch-none select-none"
                style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    zIndex: 51
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
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
                        className="w-[320px] bg-[#1C1C1C] border-[#333] text-white p-0 shadow-xl overflow-hidden pointer-events-auto"
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

            {/* Top Right Controls (Connection + Recording + Future Controls) */}
<div className="absolute top-4 right-4 pointer-events-auto flex items-center gap-3">

    {/* Connection Indicator - Only show if poor or offline */}
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

</div>

        </div>
    );
}
