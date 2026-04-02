
import { Participant } from '@/types';
import { Mic, MicOff, Video, VideoOff, Pin, Hand, StopCircle, MousePointer2, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useChatStore } from '@/stores/useChatStore';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui'; // Consolidated import
import { useMediaStore } from '@/stores/useMediaStore';
import { useBreakoutStore } from '@/stores/useBreakoutStore';
import { toast } from 'sonner';
import { RemoteControlStream } from './RemoteControlStream';

// --- VideoTile.tsx ---

interface VideoTileProps {
    participant: Participant;
    isActive?: boolean;
    isPinned?: boolean;
    onPin?: () => void;
    className?: string;
    onClick?: () => void;
    fullscreen?: boolean;
    onExitFullscreen?: () => void;
}

export function VideoTile({
    participant,
    isActive,
    isPinned,
    onPin,
    className,
    onClick,
    fullscreen,
    onExitFullscreen
}: VideoTileProps) {
    const {
        participants,
        updateParticipant,
        toggleParticipantAudio,
        toggleParticipantVideo
    } = useParticipantsStore();
    const { user } = useAuthStore();
    const {
        localStream,
        toggleAudio,
        toggleVideo,
        setLocalStream,
        setMicConfirm,
        setVideoConfirm,
        showMicConfirm,
        showVideoConfirm,
        isAudioMuted: msAudioMuted,
        isVideoOff: msVideoOff,
        isJoinedAsHost,
        meeting
    } = useMeetingStore();
    const { remoteStreams } = useMediaStore();

    const { localUserId } = useChatStore();

    // Logic to update local participant id matching. 
    // Matches logic in VideoGrid for consistency.
    const isLocal =
        participant.id === user?.id ||
        participant.id === `participant-${user?.id}` ||
        participant.id === localUserId;

    // Get current user role from participants list
    const currentUserParticipant = participants.find(p => p.id === localUserId || p.id === user?.id || p.id === `participant-${user?.id}`);
    const currentUserRole = currentUserParticipant?.role || user?.role || 'participant';
    const isHostOrCoHost = isJoinedAsHost || currentUserRole === 'host' || currentUserRole === 'co-host';
    const canSeeHandQueue = isHostOrCoHost || !!currentUserParticipant?.isHandRaised;

    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // Show real local stream for the current user/guest only
        if (isLocal && videoRef.current && localStream) {
            console.log('VideoTile: Setting local stream', {
                participantId: participant.id,
                hasStream: !!localStream,
                streamActive: localStream.active,
                videoTracks: localStream.getVideoTracks().length
            });
            videoRef.current.srcObject = localStream;
        }
        // Show remote stream if available
        else if (!isLocal && videoRef.current) {
            // @ts-ignore - participant.socketId comes from backend metadata
            const stream = remoteStreams[participant.socketId];
            if (stream) {
                console.log('VideoTile: Setting remote stream', {
                    participantId: participant.id,
                    socketId: participant.socketId,
                    hasStream: !!stream
                });
                videoRef.current.srcObject = stream;
            }
        }
    }, [isLocal, localStream, remoteStreams, participant, participant.isVideoOff]);

    const handleToggleMuteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showMicConfirm || showVideoConfirm) return;

        if (isLocal) {
            const isSuspended = useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities;
            if (isSuspended && !isHostOrCoHost) {
                toast.error("Activities are suspended by host");
                return;
            }
            setMicConfirm(true);
        } else if (isHostOrCoHost) {
            if (!participant.isAudioMuted) {
                // Host/Co-host can only MUTE directly
                toggleParticipantAudio(participant.id);
            } else {
                // If already muted, request to unmute
                if (meeting?.id) {
                    useChatStore.getState().requestMedia(meeting.id, participant.id, 'audio');
                }
            }
        }
    };

    const handleToggleVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showMicConfirm || showVideoConfirm) return;

        if (isLocal) {
            const isSuspended = useMeetingStore.getState().meeting?.settings?.suspendParticipantActivities;
            if (isSuspended && !isHostOrCoHost) {
                toast.error("Activities are suspended by host");
                return;
            }
            setVideoConfirm(true);
        } else if (isHostOrCoHost) {
            if (!participant.isVideoOff) {
                // Host/Co-host can only TURN OFF directly
                toggleParticipantVideo(participant.id);
            } else {
                // If already off, request to start video
                if (meeting?.id) {
                    useChatStore.getState().requestMedia(meeting.id, participant.id, 'video');
                }
            }
        }
    };


    // Responsive logic for button visibility/layout
    // md = 768px (Tailwind)
    // Use window.innerWidth for SSR-safe check (or use a hook in real app)
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

    // Show both buttons always on mobile and fullscreen, only pin on hover in grid
    const showBothButtons = isMobile || fullscreen;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: fullscreen ? 1 : 0.95 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
                'relative aspect-square bg-[#232323] rounded-lg overflow-hidden group min-h-[200px] md:min-h-[280px] cursor-pointer shadow-lg border border-[#333]',
                isPinned && 'ring-2 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
                !isPinned && participant.isHandRaised && 'ring-2 ring-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]',
                fullscreen && 'w-full h-full',
                className
            )}
            onClick={onClick}
        >
            {/* Main Content (Video/Avatar) */}
            <div className="absolute inset-0 flex items-center justify-center bg-black">
                {/* Pin + Close buttons container (top-right) */}
                {(onPin || (fullscreen && onExitFullscreen)) && (
                    <div
                        className={cn(
                            'absolute top-2 right-2 z-20 flex gap-2',
                            showBothButtons ? '' : 'pointer-events-none'
                        )}
                    >
                        {/* Pin Button */}
                        {onPin && (
                            <button
                                onClick={e => { e.stopPropagation(); onPin(); }}
                                className={cn(
                                    'p-1.5 bg-black/50 rounded-md transition-opacity hover:bg-black/70',
                                    showBothButtons ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 pointer-events-auto',
                                    'focus:outline-none'
                                )}
                                tabIndex={showBothButtons ? 0 : -1}
                                aria-label={isPinned ? 'Unpin participant' : 'Pin participant'}
                            >
                                <Pin className={cn('w-4 h-4', isPinned ? 'text-blue-500' : 'text-white')} />
                            </button>
                        )}
                        {/* Close (X) Button */}
                        {((fullscreen && onExitFullscreen) || isMobile) && onExitFullscreen && (
                            <button
                                className="p-1.5 bg-black/50 rounded-md hover:bg-black/70 focus:outline-none"
                                onClick={(e) => { e.stopPropagation(); onExitFullscreen(); }}
                                aria-label="Exit fullscreen"
                            >
                                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white">
                                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {participant.isVideoOff ? (
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
                        style={{ backgroundColor: participant.avatar }}
                    >
                        {participant.name.charAt(0).toUpperCase()}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center overflow-hidden bg-gray-900 rounded-lg">
                        {isLocal && localStream ? (
                            <video
                                ref={videoRef}
                                id="local-video"
                                autoPlay
                                playsInline
                                muted
                                onLoadedMetadata={(e) => e.currentTarget.play()}
                                className="w-full h-full object-cover transform -scale-x-100 rounded-lg"
                                style={{ backgroundColor: '#1f2937' }}
                            />
                        ) : !isLocal && (participant as any).socketId && remoteStreams[(participant as any).socketId] ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                onLoadedMetadata={(e) => e.currentTarget.play()}
                                className="w-full h-full object-cover rounded-lg"
                                style={{ backgroundColor: '#1f2937' }}
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center rounded-lg">
                                <Video className="w-12 h-12 text-gray-500" />
                            </div>
                        )}
                    </div>
                )}

                {/* Hand Raised Indicator - top right, next to pin */}
                <AnimatePresence>
                    {participant.isHandRaised && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{
                                scale: 1,
                                opacity: 1,
                                transition: { type: 'spring', stiffness: 300, damping: 20 }
                            }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute top-2 right-2 mr-10 p-1.5 bg-yellow-500 rounded-md z-10 flex items-center justify-center shadow gap-1.5"
                        >
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatType: 'loop'
                                }}
                            >
                                <Hand className="w-4 h-4 text-white" />
                            </motion.div>
                            {participant.handRaiseNumber && canSeeHandQueue && (
                                <span className="text-xs font-bold text-white leading-none">
                                    {participant.handRaiseNumber}
                                </span>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Info Bar anchored to bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 z-10">
                <div className="flex items-center justify-between min-w-0 flex-nowrap whitespace-nowrap">
                    <div className="flex items-center gap-2 min-w-0 flex-nowrap">
                        <span className="text-white text-sm font-medium truncate max-w-[70px] min-w-0">
                            {participant.name} {isLocal && '(You)'}
                        </span>
                        {participant.role === 'host' && (
                            <span className="text-[10px] bg-[#3B82F6] text-white px-1.5 py-0.5 rounded font-medium tracking-wide flex-shrink-0">
                                Host
                            </span>
                        )}
                        {participant.role === 'co-host' && (
                            <span className="text-[10px] bg-[#8B5CF6] text-white px-1.5 py-0.5 rounded font-medium tracking-wide flex-shrink-0">
                                Co-Host
                            </span>
                        )}
                    </div>

                    {/* Interactive Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap">
                        {/* Only allow toggling if it's participant, co-host OR self OR current user is Host/Co-host */}
                        {(participant.role === 'participant' || participant.role === 'co-host' || isLocal || isHostOrCoHost) ? (
                            <>
                                <div className="relative">
                                    <button
                                        onClick={handleToggleMuteClick}
                                        className={cn(
                                            "p-1.5 rounded-full transition-colors hover:bg-white/20 flex-shrink-0",
                                            // Priority: Local State > Participant State
                                            (isLocal ? msAudioMuted : participant.isAudioMuted)
                                                ? "bg-red-500/20 text-red-500"
                                                : "text-white"
                                        )}
                                    >
                                        {(isLocal ? msAudioMuted : participant.isAudioMuted) ? (
                                            <MicOff className="w-4 h-4" />
                                        ) : (
                                            <Mic className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={handleToggleVideoClick}
                                        className={cn(
                                            "p-1.5 rounded-full transition-colors hover:bg-white/20 flex-shrink-0",
                                            (isLocal ? msVideoOff : participant.isVideoOff)
                                                ? "bg-red-500/20 text-red-500"
                                                : "text-white"
                                        )}
                                    >
                                        {(isLocal ? msVideoOff : participant.isVideoOff) ? (
                                            <VideoOff className="w-4 h-4" />
                                        ) : (
                                            <Video className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-1.5 text-white/40 flex-shrink-0">
                                    {participant.isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </div>
                                <div className="p-1.5 text-white/40 flex-shrink-0">
                                    {participant.isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// --- ScreenShareView.tsx ---

interface ScreenShareViewProps {
    participant: Participant;
    stream: MediaStream;
    isLocal: boolean;
}

export function ScreenShareView({ participant, stream, isLocal }: ScreenShareViewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { remoteControlState, meeting } = useMeetingStore();
    const { sendControlEvent, stopControl } = useChatStore();

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Handle incoming events (for the controlled user)
    useEffect(() => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controlled') return;

        const handleRemoteEvent = (e: any) => {
            const event = e.detail;
            const x = event.x * window.innerWidth;
            const y = event.y * window.innerHeight;

            const dispatchMouseEvent = (type: string, button: number = 0) => {
                const el = document.elementFromPoint(x, y) as HTMLElement;
                if (el) {
                    const buttons = button === 0 ? 1 : (button === 2 ? 2 : (button === 1 ? 4 : 0));
                    const opt = {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: x,
                        clientY: y,
                        button: button,
                        buttons: buttons,
                        which: button + 1,
                        pointerId: 1,
                        pointerType: 'mouse',
                        isPrimary: true
                    };

                    // Dispatch Pointer Events for better compatibility
                    if (type === 'mousedown') el.dispatchEvent(new PointerEvent('pointerdown', opt));
                    if (type === 'mouseup') el.dispatchEvent(new PointerEvent('pointerup', opt));

                    el.dispatchEvent(new MouseEvent(type, opt));
                    if (type === 'click' || type === 'mousedown') el.focus();
                }
            };

            if (event.type === 'remote_mouse_move') {
                // cursor position not stored
            } else if (event.type === 'remote_mouse_down') {
                dispatchMouseEvent('mousedown', event.button);
            } else if (event.type === 'remote_mouse_up') {
                dispatchMouseEvent('mouseup', event.button);
            } else if (event.type === 'remote_mouse_click') {
                dispatchMouseEvent('click', event.button);
            } else if (event.type === 'remote_mouse_double_click') {
                dispatchMouseEvent('dblclick', event.button);
            } else if (event.type === 'remote_mouse_context_menu') {
                dispatchMouseEvent('contextmenu', 2);
            } else if (event.type === 'remote_key_down' || event.type === 'remote_key_press') {
                const el = document.activeElement as HTMLElement;

                // Dispatch KeyboardEvent first
                const keyOpt = {
                    key: event.key,
                    code: event.code,
                    bubbles: true,
                    cancelable: true,
                    keyCode: event.keyCode,
                    which: event.keyCode
                };
                el.dispatchEvent(new KeyboardEvent('keydown', keyOpt));

                // Handle text input specifically
                if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) {
                    const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
                    if ('value' in inputEl) {
                        const start = inputEl.selectionStart || 0;
                        const end = inputEl.selectionEnd || 0;
                        const val = inputEl.value;

                        if (event.key === 'Backspace') {
                            inputEl.value = val.slice(0, Math.max(0, start - (start === end ? 1 : 0))) + val.slice(end);
                            inputEl.selectionStart = inputEl.selectionEnd = Math.max(0, start - 1);
                        } else if (event.key === 'Delete') {
                            inputEl.value = val.slice(0, start) + val.slice(end + (start === end ? 1 : 0));
                            inputEl.selectionStart = inputEl.selectionEnd = start;
                        } else if (event.key === 'Enter') {
                            if (inputEl instanceof HTMLInputElement) {
                                inputEl.form?.requestSubmit();
                            } else {
                                inputEl.value = val.slice(0, start) + '\n' + val.slice(end);
                                inputEl.selectionStart = inputEl.selectionEnd = start + 1;
                            }
                        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
                            inputEl.value = val.slice(0, start) + event.key + val.slice(end);
                            inputEl.selectionStart = inputEl.selectionEnd = start + 1;
                        }

                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            } else if (event.type === 'remote_key_up') {
                const el = document.activeElement as HTMLElement;
                el.dispatchEvent(new KeyboardEvent('keyup', { key: event.key, bubbles: true }));
            } else if (event.type === 'remote_scroll') {
                window.scrollBy({ top: event.deltaY, behavior: 'auto' });
            }
        };

        window.addEventListener('remote_control_event', handleRemoteEvent);
        return () => window.removeEventListener('remote_control_event', handleRemoteEvent);
    }, [remoteControlState.status, remoteControlState.role]);

    // Capture events (for the controller)
    const handleMouseMove = (e: React.MouseEvent) => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (meeting?.id) {
            sendControlEvent({ meetingId: meeting.id, participantId: participant.id, type: 'remote_mouse_move', x, y });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (meeting?.id) {
            sendControlEvent({
                meetingId: meeting.id,
                participantId: participant.id,
                type: 'remote_mouse_down',
                x, y,
                button: e.button
            });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (meeting?.id) {
            sendControlEvent({
                meetingId: meeting.id,
                participantId: participant.id,
                type: 'remote_mouse_up',
                x, y,
                button: e.button
            });
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (meeting?.id) {
            sendControlEvent({
                meetingId: meeting.id,
                participantId: participant.id,
                type: 'remote_mouse_click',
                x, y,
                button: e.button
            });
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (meeting?.id) {
            sendControlEvent({
                meetingId: meeting.id,
                participantId: participant.id,
                type: 'remote_mouse_double_click',
                x, y,
                button: e.button
            });
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (meeting?.id) {
            sendControlEvent({
                meetingId: meeting.id,
                participantId: participant.id,
                type: 'remote_mouse_context_menu',
                x, y
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;

        if (meeting?.id) {
            sendControlEvent({
                meetingId: meeting.id,
                participantId: participant.id,
                type: 'remote_key_down',
                key: e.key,
                code: e.code,
                keyCode: e.keyCode,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey
            });
        }
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;

        if (meeting?.id) {
            sendControlEvent({
                meetingId: meeting.id,
                participantId: participant.id,
                type: 'remote_key_up',
                key: e.key
            });
        }
    };

    const handleScroll = (e: React.WheelEvent) => {
        if (remoteControlState.status !== 'active' || remoteControlState.role !== 'controller') return;
        if (remoteControlState.targetId !== participant.id) return;

        if (meeting?.id) {
            sendControlEvent({
                meetingId: meeting.id,
                participantId: participant.id,
                type: 'remote_scroll',
                deltaY: e.deltaY
            });
        }
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black rounded-xl overflow-hidden group outline-none"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onWheel={handleScroll}
            tabIndex={remoteControlState.status === 'active' && remoteControlState.role === 'controller' ? 0 : -1}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => e.currentTarget.play()}
                className="w-full h-full object-cover pointer-events-none"
            />

            {/* Remote Cursor display removed - cursor position not stored */}

            {/* Controller Instructions Overlay */}
            {remoteControlState.status === 'active' && remoteControlState.role === 'controller' && remoteControlState.targetId === participant.id && (
                <div className="absolute top-4 right-4 bg-blue-500/90 text-white text-xs px-3 py-1 rounded-full z-40 pointer-events-none">
                    Remote Controlling - Click to type
                </div>
            )}

            {/* Overlay info */}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-white text-sm font-medium">
                    {participant.name}'s screen
                </span>
            </div>
            {/* Tooltip or Label */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-black/60 backdrop-blur-md px-4 py-1 rounded-full text-xs text-white/80 border border-white/5">
                    Viewing shared screen
                </div>
            </div>
        </div>
    );
}

// --- VideoGrid.tsx ---

export function VideoGrid() {
    const { participants, activeSpeakerId, pinnedParticipantId, pinParticipant, unpinParticipant, focusedParticipantId, setFocusedParticipant } = useParticipantsStore();
    // ESC key handler for exiting fullscreen
    useEffect(() => {
        if (!focusedParticipantId) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setFocusedParticipant(null);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [focusedParticipantId]);
    const { viewMode, showSelfView, screenShareStream, isScreenSharing: isLocalScreenSharing, meeting, isJoinedAsHost } = useMeetingStore();
    const { remoteScreenStreams } = useMediaStore();
    const { user } = useAuthStore();
    const { currentRoomId, rooms, isBreakoutActive } = useBreakoutStore();
    const { nativeAgentStatus, localUserId } = useChatStore();
    const { remoteControlState } = useMeetingStore();

    const currentUserParticipant = participants.find(p => p.id === user?.id || p.id === `participant-${user?.id}` || p.id === useChatStore.getState().localUserId);
    const currentUserRole = currentUserParticipant?.role || user?.role || 'participant';
    const isHostOrCoHost = isJoinedAsHost || currentUserRole === 'host' || currentUserRole === 'co-host';
    const canSeeHandQueue = isHostOrCoHost || !!currentUserParticipant?.isHandRaised;

    const handlePin = (participantId: string) => {
        if (pinnedParticipantId === participantId) {
            unpinParticipant();
        } else {
            pinParticipant(participantId);
        }
    };

    // Filter participants based on Video, Self View, and Settings
    let visibleParticipants = participants.filter(p => {
        const isLocal =
            p.id === user?.id ||
            p.id === `participant-${user?.id}` ||
            (user?.role === 'host' && p.id === 'participant-1') ||
            p.id === localUserId;

        if (isLocal && (meeting?.settings?.hideSelfView || !showSelfView)) {
            return false;
        }

        if (meeting?.settings?.hideParticipantsWithoutVideo && p.isVideoOff) {
            return false;
        }

        return true;
    });

    // 🚀 NEW: Filter by Breakout Room
    if (isBreakoutActive && currentRoomId) {
        const currentRoom = rooms.find(r => r.id === currentRoomId);
        if (currentRoom) {
            visibleParticipants = visibleParticipants.filter(p =>
                currentRoom.participants.includes(p.id) || p.role === 'host'
            );
        }
    }

    // Sort participants: Pinned first, then Hand Raised (in order), then others
    visibleParticipants = [...visibleParticipants].sort((a, b) => {
        // 1. Pinned
        if (a.id === pinnedParticipantId) return -1;
        if (b.id === pinnedParticipantId) return 1;

        // 2. Hand Raised
        if (canSeeHandQueue) {
            if (a.isHandRaised && !b.isHandRaised) return -1;
            if (!a.isHandRaised && b.isHandRaised) return 1;
            if (a.isHandRaised && b.isHandRaised) {
                return (a.handRaiseNumber || 0) - (b.handRaiseNumber || 0);
            }
        }

        // 3. Role (Host first)
        if (meeting?.settings?.followHostVideoOrder) {
            if (a.role === 'host') return -1;
            if (b.role === 'host') return 1;
        }

        return 0;
    });

    // Identify who is sharing screen
    const remoteSharingParticipant = participants.find(p => p.isScreenSharing && !p.id.includes(user?.id || ''));
    const isLocalSharing = isLocalScreenSharing && screenShareStream;
    const sharingParticipant = remoteSharingParticipant || (isLocalSharing ? participants.find(p => p.id === user?.id || p.id === `participant-${user?.id}`) : null);
    const screenStream = remoteSharingParticipant
        ? remoteScreenStreams[remoteSharingParticipant.socketId || '']
        : (isLocalSharing ? screenShareStream : null);

    // Fullscreen logic
    if (focusedParticipantId) {
        const participant = participants.find(p => p.id === focusedParticipantId);
        if (!participant) return null;
        return (
            <div className="relative h-dvh overflow-hidden">
                <div className="h-full pt-[30px] pb-[105px] flex items-center justify-center">
                    <div className="w-full h-full bg-black rounded-xl overflow-hidden">
                        <VideoTile
                            participant={participant}
                            isActive={participant.id === activeSpeakerId}
                            isPinned={pinnedParticipantId === participant.id}
                            onPin={() => handlePin(participant.id)}
                            onClick={() => setFocusedParticipant(null)}
                            fullscreen
                            onExitFullscreen={() => setFocusedParticipant(null)}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // View Mode Logic (Speaker)
    if (viewMode === 'speaker' && !sharingParticipant && !focusedParticipantId && visibleParticipants.length > 1) {
        const currentLocalUserId = user?.id || `guest-${useChatStore.getState().socket?.id}`;

        let speakerParticipant = null;
        if (activeSpeakerId) {
            speakerParticipant = visibleParticipants.find(p => p.id === activeSpeakerId);
        }
        if (!speakerParticipant && pinnedParticipantId) {
            speakerParticipant = visibleParticipants.find(p => p.id === pinnedParticipantId);
        }
        if (!speakerParticipant) {
            speakerParticipant = visibleParticipants.find(p => p.id !== currentLocalUserId) || visibleParticipants[0];
        }

        const otherParticipants = visibleParticipants.filter(p => p.id !== speakerParticipant?.id);

        return (
            <div className="flex flex-col h-full w-full p-4 overflow-hidden pt-[30px] pb-[105px]">
                {/* Main Speaker Area */}
                {speakerParticipant && (
                    <div className="flex-1 min-w-0 bg-black rounded-xl overflow-hidden mb-4 relative">
                        <VideoTile
                            participant={speakerParticipant}
                            isActive={true}
                            isPinned={pinnedParticipantId === speakerParticipant.id}
                            onPin={() => handlePin(speakerParticipant.id)}
                            onClick={() => setFocusedParticipant(speakerParticipant.id)}
                            fullscreen={true}
                            className="w-full h-full object-contain"
                        />
                    </div>
                )}

                {/* Other Participants (Bottom Row) */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0 shadow-sm border border-[#333] p-2 rounded-xl bg-[#1C1C1C]">
                    {otherParticipants.map((participant) => (
                        <div key={participant.id} className="w-48 aspect-video shrink-0">
                            <VideoTile
                                participant={participant}
                                isActive={participant.id === activeSpeakerId}
                                isPinned={pinnedParticipantId === participant.id}
                                onPin={() => handlePin(participant.id)}
                                onClick={() => setFocusedParticipant(participant.id)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // View Mode Logic (Multi-Speaker)
    if (viewMode === 'multi-speaker' && !sharingParticipant && !focusedParticipantId && visibleParticipants.length > 2) {
        // Just an active speaker focus but allowing top 3-4 to take bulk space
        const topSpeakers = visibleParticipants.slice(0, Math.min(4, visibleParticipants.length));
        const restParticipants = visibleParticipants.slice(topSpeakers.length);

        return (
            <div className="flex flex-col h-full w-full p-4 overflow-hidden pt-[30px] pb-[105px] gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                    {topSpeakers.map((participant) => (
                        <div key={participant.id} className="w-full h-full bg-black rounded-xl overflow-hidden relative">
                            <VideoTile
                                participant={participant}
                                isActive={participant.id === activeSpeakerId}
                                isPinned={pinnedParticipantId === participant.id}
                                onPin={() => handlePin(participant.id)}
                                onClick={() => setFocusedParticipant(participant.id)}
                                fullscreen={true}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>
                {restParticipants.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0 shadow-sm border border-[#333] p-2 rounded-xl bg-[#1C1C1C] h-32">
                        {restParticipants.map((participant) => (
                            <div key={participant.id} className="w-48 aspect-video shrink-0">
                                <VideoTile
                                    participant={participant}
                                    isActive={participant.id === activeSpeakerId}
                                    isPinned={pinnedParticipantId === participant.id}
                                    onPin={() => handlePin(participant.id)}
                                    onClick={() => setFocusedParticipant(participant.id)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // View Mode Logic (Immersive)
    if (viewMode === 'immersive' && !sharingParticipant && !focusedParticipantId) {
        return (
            <div className="flex flex-col h-full w-full p-4 overflow-hidden pt-[30px] pb-[105px]">
                <div className="w-full h-full bg-[#1C1C1C] rounded-2xl border border-[#333] relative overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 opacity-10 pointer-events-none scale-150 blur-3xl animate-pulse bg-blue-500/20 rounded-full" />

                    <div className="absolute inset-x-8 bottom-8 top-16 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 place-content-center">
                        {visibleParticipants.map((participant, i) => (
                            <motion.div
                                key={participant.id}
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1, transition: { delay: i * 0.1 } }}
                                className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/5 bg-black"
                                style={{ aspectRatio: '16/9' }}
                            >
                                <VideoTile
                                    participant={participant}
                                    isActive={participant.id === activeSpeakerId}
                                    isPinned={pinnedParticipantId === participant.id}
                                    onPin={() => handlePin(participant.id)}
                                    onClick={() => setFocusedParticipant(participant.id)}
                                    fullscreen={true}
                                />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Layout when remote controlling
    const isRemoteControlling = nativeAgentStatus.status === 'connected' && remoteControlState.role === 'controller';
    
    if (isRemoteControlling) {
        return (
            <div className="flex flex-col md:flex-row h-full w-full gap-4 p-0 overflow-hidden pt-0 pb-[105px]">
                {/* Main Remote Control Area */}
                <div className="flex-1 min-w-0 bg-black rounded-xl overflow-hidden relative">
                    <RemoteControlStream />
                </div>

                {/* Participant Sidebar */}
                <div className="w-full md:w-80 flex-shrink-0 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto no-scrollbar pb-2 md:pb-0">
                    {visibleParticipants.map((participant) => (
                        <div key={participant.id} className="w-48 md:w-full flex-shrink-0">
                            <VideoTile
                                participant={participant}
                                isActive={participant.id === activeSpeakerId}
                                isPinned={pinnedParticipantId === participant.id}
                                onPin={() => handlePin(participant.id)}
                                onClick={() => setFocusedParticipant(participant.id)}
                                className="aspect-video h-auto"
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Layout when someone is sharing
    if (sharingParticipant && screenStream) {
        return (
            <div className="flex flex-col md:flex-row h-full w-full gap-2 p-0 overflow-hidden pt-0 pb-[105px]">
                {/* Main Screen Share Area */}
                <div className="flex-1 min-w-0 bg-black rounded-xl overflow-hidden relative">
                    <ScreenShareView
                        participant={sharingParticipant}
                        stream={screenStream}
                        isLocal={!!isLocalSharing && !remoteSharingParticipant}
                    />
                </div>

                {/* Participant Sidebar */}
                <div className="w-full md:w-80 flex-shrink-0 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto no-scrollbar pb-2 md:pb-0">
                    {visibleParticipants.map((participant) => (
                        <div key={participant.id} className="w-48 md:w-full flex-shrink-0">
                            <VideoTile
                                participant={participant}
                                isActive={participant.id === activeSpeakerId}
                                isPinned={pinnedParticipantId === participant.id}
                                onPin={() => handlePin(participant.id)}
                                onClick={() => setFocusedParticipant(participant.id)}
                                className="aspect-video h-auto"
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const participantCount = visibleParticipants.length;

    return (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar relative">
            <div className={cn(
                'p-4 w-full min-h-full flex flex-col items-center justify-center pb-[120px]',
            )}>
                <div
                    className={cn(
                        'grid gap-4 w-full',
                        participantCount === 1 ? 'max-w-2xl' : 'max-w-7xl'
                    )}
                    style={{
                        gridTemplateColumns: participantCount === 1
                            ? '1fr'
                            : typeof window !== 'undefined' && window.innerWidth >= 768
                                ? `repeat(auto-fit, minmax(${participantCount <= 2 ? '320px' : '260px'}, 1fr))`
                                : 'repeat(auto-fit, minmax(160px, 1fr))',
                        gridAutoRows: 'auto',
                        alignItems: 'center',
                        justifyItems: 'center',
                    }}
                >
                    {visibleParticipants.map((participant) => (
                        <VideoTile
                            key={participant.id}
                            participant={participant}
                            isActive={participant.id === activeSpeakerId}
                            isPinned={pinnedParticipantId === participant.id}
                            onPin={() => handlePin(participant.id)}
                            onClick={() => setFocusedParticipant(participant.id)}
                            className="w-full"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// --- ScreenShareBanner.tsx ---

export function ScreenShareBanner() {
    const { isScreenSharing, toggleScreenShare, screenShareStream, setScreenShareStream } = useMeetingStore();

    const handleStopShare = () => {
        if (screenShareStream) {
            screenShareStream.getTracks().forEach(track => track.stop());
            setScreenShareStream(null);
        }
        if (isScreenSharing) {
            toggleScreenShare();
        }
    };

    return (
        <AnimatePresence>
            {isScreenSharing && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[60] flex justify-center pointer-events-none"
                >
                    <div className="bg-transparent pt-4 flex flex-col items-center pointer-events-auto">
                        <div className="flex items-center bg-[#10B981] text-white rounded-t-lg px-6 py-2 shadow-lg gap-3">
                            <span className="font-semibold text-lg flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                </span>
                                You are screen sharing
                            </span>
                        </div>
                        <div className="bg-[#1C1C1C] border border-t-0 border-[#333] rounded-b-lg px-6 py-2 flex items-center gap-4 shadow-xl">
                            <span className="text-sm text-gray-400">
                                Stop sharing to switch windows
                            </span>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleStopShare}
                                className="bg-[#E53935] hover:bg-[#D32F2F] text-white h-8 px-4 flex items-center gap-2"
                            >
                                <StopCircle className="w-4 h-4" />
                                Stop Share
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
