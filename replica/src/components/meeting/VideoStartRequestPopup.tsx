import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, X, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useChatStore } from '@/stores/useChatStore';

export function VideoStartRequestPopup() {
    const { videoRequestState, setVideoRequestState, meeting, isJoinedAsHost } = useMeetingStore();
    const { respondToVideoRequest, socket } = useChatStore();
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        if (videoRequestState.status === 'pending') {
            setTimeLeft(30);
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        handleResponse(false); // Auto-deny
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [videoRequestState.status]);

    const handleResponse = (accepted: boolean) => {
        if (!meeting?.id || !socket?.id) return;

        const hostId = videoRequestState.requesterId || meeting.hostId;

        respondToVideoRequest(meeting.id, hostId, socket.id, accepted);
        setVideoRequestState({ status: 'idle', requesterName: '', requesterId: '' });

        if (accepted) {
            // Turning on video locally
            const ms = useMeetingStore.getState();
            if (ms.isVideoOff) {
                ms.toggleVideo();
            }
        }
    };

    if (videoRequestState.status !== 'pending') return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4"
            >
                <div className="bg-[#232323] border border-[#404040] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Video className="w-6 h-6 text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-semibold text-lg">
                                Video Request
                            </h3>
                            <p className="text-gray-400 text-sm">
                                <span className="text-white font-medium">{videoRequestState.requesterName}</span> asks you to start your video.
                            </p>
                        </div>
                        <div className="text-blue-400 font-mono text-xl font-bold bg-blue-500/5 px-3 py-1 rounded-lg border border-blue-500/10">
                            {timeLeft}s
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1 border-[#404040] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all font-semibold"
                            onClick={() => handleResponse(false)}
                        >
                            <X className="w-4 h-4 mr-2" />
                            Deny
                        </Button>
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/20 transition-all"
                            onClick={() => handleResponse(true)}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Accept
                        </Button>
                    </div>

                    {/* Progress bar for timer */}
                    <div className="absolute bottom-0 left-0 h-1 bg-blue-500/30 w-full overflow-hidden rounded-b-xl">
                        <motion.div
                            className="h-full bg-blue-500"
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: 30, ease: "linear" }}
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
