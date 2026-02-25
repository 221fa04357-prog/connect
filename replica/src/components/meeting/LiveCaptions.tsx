import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

interface Caption {
    id: string;
    text: string;
    name: string;
    timestamp: number;
}

const LiveCaptions = () => {
    const { socket, localUserId } = useChatStore();
    const { localStream, isAudioMuted, meeting, showCaptions } = useMeetingStore();
    const { user } = useAuthStore();

    const [captions, setCaptions] = useState<Caption[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (!socket) return;

        const handleTranscript = (data: { text: string, userId: string, sender_name: string }) => {
            const newCap: Caption = {
                id: `${data.userId}-${Date.now()}-${Math.random()}`,
                text: data.text,
                name: data.sender_name,
                timestamp: Date.now()
            };

            setCaptions(prev => {
                const filtered = prev.filter(c => Date.now() - c.timestamp < 5000);
                return [...filtered, newCap].slice(-3); // Keep last 3
            });
        };

        socket.on('transcript_result', handleTranscript);

        // Auto-clear old captions every second
        const interval = setInterval(() => {
            setCaptions(prev => {
                const stillValid = prev.filter(c => Date.now() - c.timestamp < 5000);
                if (stillValid.length !== prev.length) return stillValid;
                return prev;
            });
        }, 1000);

        return () => {
            socket.off('transcript_result');
            clearInterval(interval);
        };
    }, [socket]);

    useEffect(() => {
        // Only start recording if we have a stream, are NOT muted, and have a meeting context
        if (!localStream || isAudioMuted || !socket || !meeting?.id || !showCaptions) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current = null;
            }
            return;
        }

        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length === 0) return;

        try {
            // Create a dedicated stream for recording to ensure we only get audio
            const recordStream = new MediaStream([audioTracks[0]]);

            // Check for supported mime types
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const recorder = new MediaRecorder(recordStream, { mimeType });

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0 && socket) {
                    // Send to backend as a buffer/blob
                    // Socket.io handles Blob automatically in modern browsers
                    socket.emit('audio_chunk', {
                        audio: e.data,
                        meetingId: meeting.id,
                        userId: localUserId || user?.id || 'guest',
                        sender_name: user?.name || 'Guest'
                    });
                }
            };

            recorder.onerror = (err) => {
                console.error('MediaRecorder error:', err);
            };

            // Start recording in 2-second slices for better Whisper context 
            // 1s is very short and might lead to broken words. 2s is a sweet spot for real-time.
            recorder.start(2000);
            mediaRecorderRef.current = recorder;

        } catch (err) {
            console.error('Failed to initialize MediaRecorder:', err);
        }

        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current = null;
            }
        };
    }, [localStream, isAudioMuted, socket, meeting?.id, localUserId, user, showCaptions]);

    if (captions.length === 0 || !showCaptions) return null;

    return (
        <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-xl px-4 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
                <AnimatePresence>
                    {captions.map((cap) => (
                        <motion.div
                            key={cap.id}
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-black/70 backdrop-blur-lg px-5 py-2.5 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3"
                        >
                            <div className="flex flex-col">
                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">
                                    {cap.name}
                                </span>
                                <span className="text-white text-sm md:text-base leading-snug font-medium">
                                    {cap.text}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default LiveCaptions;
