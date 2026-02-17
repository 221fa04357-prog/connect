
import { Participant } from '@/types';
import { Mic, MicOff, Video, VideoOff, Pin, Hand, StopCircle, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui'; // Consolidated import
import { useMediaStore } from '@/stores/useMediaStore';

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
        showVideoConfirm
    } = useMeetingStore();
    const { remoteStreams } = useMediaStore();

    // Logic to update local participant id matching. 
    // Matches logic in VideoGrid for consistency.
    const isLocal =
        participant.id === user?.id ||
        participant.id === `participant-${user?.id}` ||
        (user?.role === 'host' && participant.id === 'participant-1');

    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // Show real local stream for the current user/guest only
        if (isLocal && videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
        // Show remote stream if available
        else if (!isLocal && videoRef.current) {
            // @ts-ignore - participant.socketId comes from backend metadata
            const stream = remoteStreams[participant.socketId];
            if (stream) {
                videoRef.current.srcObject = stream;
            }
        }
    }, [isLocal, localStream, remoteStreams, participant, participant.isVideoOff]);

    const handleToggleMuteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showMicConfirm || showVideoConfirm) return;
        // Only allow local user to toggle their own mic
        if (isLocal) setMicConfirm(true);
    };

    const handleToggleVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showMicConfirm || showVideoConfirm) return;
        // Only allow local user to toggle their own video
        if (isLocal) setVideoConfirm(true);
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
                'relative aspect-video bg-[#232323] rounded-lg overflow-hidden group min-h-[180px] cursor-pointer',
                isPinned && 'ring-2 ring-blue-500',
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
                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                        {isLocal && localStream ? (
                            <video
                                ref={videoRef}
                                id="local-video"
                                autoPlay
                                playsInline
                                muted
                                onLoadedMetadata={(e) => e.currentTarget.play()}
                                className="w-full h-full object-cover transform -scale-x-100"
                            />
                        ) : !isLocal && (participant as any).socketId && remoteStreams[(participant as any).socketId] ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                onLoadedMetadata={(e) => e.currentTarget.play()}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                <Video className="w-12 h-12 text-gray-500" />
                            </div>
                        )}
                    </div>
                )}

                {/* Hand Raised Indicator - top right, next to pin */}
                {participant.isHandRaised && (
                    <div className="absolute top-2 right-2 mr-10 p-1.5 bg-yellow-500 rounded-md z-10 flex items-center justify-center shadow">
                        <Hand className="w-4 h-4 text-white" />
                    </div>
                )}
            </div>

            {/* Bottom Info Bar anchored to bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 z-10">
                <div className="flex items-center justify-between min-w-0 flex-nowrap whitespace-nowrap">
                    <div className="flex items-center gap-2 min-w-0 flex-nowrap">
                        <span className="text-white text-sm font-medium truncate max-w-[70px] min-w-0">
                            {participant.name} {isLocal && '(You)'}
                        </span>
                        {participant.role === 'host' && (
                            <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded flex-shrink-0">
                                Host
                            </span>
                        )}
                        {participant.role === 'co-host' && (
                            <span className="text-xs bg-purple-500 text-white px-1.5 py-0.5 rounded flex-shrink-0">
                                Co-Host
                            </span>
                        )}
                    </div>

                    {/* Interactive Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap">
                        {/* Only allow toggling if it's participant, co-host OR self */}
                        {(participant.role === 'participant' || participant.role === 'co-host' || isLocal) ? (
                            <>
                                <div className="relative">
                                    <button
                                        onClick={handleToggleMuteClick}
                                        className={cn(
                                            "p-1.5 rounded-full transition-colors hover:bg-white/20 flex-shrink-0",
                                            participant.isAudioMuted ? "bg-red-500/20 text-red-500" : "text-white"
                                        )}
                                    >
                                        {participant.isAudioMuted ? (
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
                                            participant.isVideoOff ? "bg-red-500/20 text-red-500" : "text-white"
                                        )}
                                    >
                                        {participant.isVideoOff ? (
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
    const { viewMode, showSelfView } = useMeetingStore();
    const { user } = useAuthStore();

    const handlePin = (participantId: string) => {
        if (pinnedParticipantId === participantId) {
            unpinParticipant();
        } else {
            pinParticipant(participantId);
        }
    };

    // Filter participants based on Self View setting
    const visibleParticipants = participants.filter(p => {
        const isLocal =
            p.id === user?.id ||
            p.id === `participant-${user?.id}` ||
            (user?.role === 'host' && p.id === 'participant-1');
        if (isLocal) {
            return showSelfView;
        }
        return true;
    });

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

    // Responsive Zoom-like Gallery View
    return (
        <div className="flex-1 min-h-0 overflow-y-auto pb-[110px] no-scrollbar">
            <div
                className={cn(
                    'grid gap-2 md:gap-4 p-2 md:p-4 w-full',
                )}
                style={{
                    gridTemplateColumns: window.innerWidth >= 768
                        ? 'repeat(auto-fit, minmax(200px, 1fr))'
                        : 'repeat(auto-fit, minmax(140px, 1fr))',
                    gridAutoRows: '1fr',
                    alignItems: 'stretch',
                    justifyItems: 'stretch',
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
                    />
                ))}
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
