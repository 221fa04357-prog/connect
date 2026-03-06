import { useEffect, useRef } from 'react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useChatStore } from '@/stores/useChatStore';

export function TranscriptionManager() {
    const { localStream, isAudioMuted, meeting } = useMeetingStore();
    const { user } = useAuthStore();
    const { socket } = useChatStore();
    const {
        addTranscript,
        isTranscriptionEnabled,
        setCurrentCaption,
        clearCurrentCaption,
    } = useTranscriptionStore();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Listen for transcription results from the shared socket
    useEffect(() => {
        if (!socket) return; // FIX: allow all participants to see captions by removing isTranscriptionEnabled check here!

        const handleTranscription = (data: any) => {
            if (data.text) {
                console.log('%c[Transcription] Received: ' + data.text, 'color: #0B5CFF; font-weight: bold;');
                handleNewTranscription(data.text, data.participantName || 'Guest');
            }
        };

        socket.on('transcription_received', handleTranscription);
        return () => {
            socket.off('transcription_received', handleTranscription);
        };
    }, [socket]);

    const handleNewTranscription = (text: string, speakerName: string) => {
        if (!text || text.trim().length === 0) return;

        addTranscript({
            participantId: user?.id || 'guest',
            participantName: speakerName,
            text: text.trim(),
            timestamp: new Date().toISOString()
        });

        const isHost = useMeetingStore.getState().isJoinedAsHost;
        const speakerRole = isHost ? 'host' : 'participant';

        setCurrentCaption(text.trim(), speakerName, speakerRole);

        if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
        captionTimerRef.current = setTimeout(() => {
            clearCurrentCaption();
        }, 5000); // Hide after 5s of silence
    };

    useEffect(() => {
        if (!isTranscriptionEnabled || !localStream || isAudioMuted) {
            stopRecording();
            return;
        }
        const cleanup = startRecording();
        return () => {
            stopRecording();
            if (typeof cleanup === 'function') cleanup();
        };
    }, [isTranscriptionEnabled, localStream, isAudioMuted]);

    const startRecording = () => {
        if (mediaRecorderRef.current || !localStream || !socket) return;

        try {
            const audioTrack = localStream.getAudioTracks()[0];
            if (!audioTrack) return;

            // Apply noise suppression at hardware level
            audioTrack.applyConstraints({
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }).catch(e => console.warn('[Transcription] Constraints fail:', e));

            const audioStream = new MediaStream([audioTrack.clone()]);
            const audioCtx = new AudioContext();

            let isSpeakingInSegment = false;

            const startChunk = () => {
                if (!isTranscriptionEnabled || !localStream || isAudioMuted || !socket) return;

                if (audioCtx.state === 'suspended') audioCtx.resume();

                const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });
                mediaRecorderRef.current = recorder;

                recorder.ondataavailable = async (event) => {
                    if (isSpeakingInSegment && event.data.size > 0 && socket.connected) {
                        // Send as arrayBuffer for cleaner transmission through Socket.io
                        const buffer = await event.data.arrayBuffer();
                        socket.emit('audio_chunk', {
                            meetingId: meeting?.id,
                            participantId: user?.id || 'guest',
                            participantName: user?.name || 'Guest',
                            audioBlob: buffer
                        });
                    }
                    isSpeakingInSegment = false;
                };

                recorder.start();

                chunkTimerRef.current = setTimeout(() => {
                    if (recorder.state === 'recording') {
                        recorder.stop();
                        startChunk();
                    }
                }, 2000); // FIX: 2.0s chunks for smoother real-time feel to combine fragments!
            };

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            audioCtx.createMediaStreamSource(audioStream).connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkVolume = () => {
                if (!isTranscriptionEnabled || !audioCtx) return;
                analyser.getByteFrequencyData(dataArray);
                const peak = Math.max(...Array.from(dataArray));
                if (peak > 5) isSpeakingInSegment = true; // Lower threshold to catch softer speech
                requestAnimationFrame(checkVolume);
            };
            checkVolume();

            startChunk();

            return () => {
                if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
                mediaRecorderRef.current = null;
                audioCtx.close();
                audioStream.getTracks().forEach(t => t.stop());
            };
        } catch (err) {
            console.error('Failed to start transcription recorder:', err);
        }
    };

    const stopRecording = () => {
        if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        }
    };

    return null;
}
