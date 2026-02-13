import { Participant } from '@/types';
import { Mic, MicOff, Video, VideoOff, Pin, Hand } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

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

export default function VideoTile({
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
    }, [isLocal, localStream, participant.isVideoOff]);

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
                {/* Cross button always visible in top-right */}
                {fullscreen && onExitFullscreen && (
                    <button
                        className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center bg-neutral-800 bg-opacity-80 rounded-full hover:bg-neutral-700 transition-colors border border-neutral-700"
                        onClick={(e) => { e.stopPropagation(); onExitFullscreen(); }}
                        aria-label="Exit fullscreen"
                    >
                        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white">
                            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
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
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                <Video className="w-12 h-12 text-gray-500" />
                            </div>
                        )}
                    </div>
                )}

                    {/* Top-right controls: pin & cross button side by side in fullscreen, always visible */}
                    {fullscreen && (
                        <div className="absolute top-3 right-3 z-20 flex gap-2">
                            {onPin && (
                                <button
                                    onClick={onPin}
                                    className="w-8 h-8 flex items-center justify-center bg-black/50 rounded-full border border-neutral-700"
                                    aria-label="Pin participant"
                                >
                                    <Pin className={cn('w-5 h-5', isPinned ? 'text-blue-500' : 'text-white')} />
                                </button>
                            )}
                            {onExitFullscreen && (
                                <button
                                    className="w-8 h-8 flex items-center justify-center bg-neutral-800 bg-opacity-80 rounded-full hover:bg-neutral-700 transition-colors border border-neutral-700"
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


