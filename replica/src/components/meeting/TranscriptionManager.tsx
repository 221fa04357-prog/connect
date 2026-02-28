import { useEffect, useRef } from 'react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useChatStore } from '@/stores/useChatStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';

export function TranscriptionManager() {
    const { localStream, isAudioMuted } = useMeetingStore();
    const { socket, meetingId } = useChatStore();
    const { user } = useAuthStore();
    const { addTranscript, isTranscriptionEnabled, setCurrentCaption, clearCurrentCaption } = useTranscriptionStore();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    // Timer ref to auto-clear the caption after 3 seconds of silence
    const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Listen for transcription events from the backend
    useEffect(() => {
        if (!socket) return;

        const handleTranscription = (segment: any) => {
            // 1. Add to the full history (for recap)
            addTranscript(segment);

            // 2. Show only the latest line as the live floating caption
            if (segment.text && segment.text.trim().length > 0) {
                setCurrentCaption(segment.text.trim());

                // 3. Auto-clear after 3 seconds of no new speech
                if (captionTimerRef.current) {
                    clearTimeout(captionTimerRef.current);
                }
                captionTimerRef.current = setTimeout(() => {
                    clearCurrentCaption();
                }, 3000);
            }
        };

        socket.on('transcription_received', handleTranscription);

        return () => {
            socket.off('transcription_received', handleTranscription);
            if (captionTimerRef.current) {
                clearTimeout(captionTimerRef.current);
            }
        };
    }, [socket, addTranscript, setCurrentCaption, clearCurrentCaption]);

    // Start/stop audio recording based on transcription state
    useEffect(() => {
        if (!isTranscriptionEnabled || !localStream || !socket || !meetingId || isAudioMuted) {
            stopRecording();
            return;
        }

        startRecording();

        return () => {
            stopRecording();
        };
    }, [isTranscriptionEnabled, localStream, isAudioMuted, socket, meetingId]);

    // Clear caption when transcription is disabled
    useEffect(() => {
        if (!isTranscriptionEnabled) {
            clearCurrentCaption();
            if (captionTimerRef.current) {
                clearTimeout(captionTimerRef.current);
            }
        }
    }, [isTranscriptionEnabled, clearCurrentCaption]);

    const startRecording = () => {
        if (mediaRecorderRef.current || !localStream) return;

        try {
            const audioTrack = localStream.getAudioTracks()[0];
            if (!audioTrack) return;

            const audioClone = audioTrack.clone();
            const audioStream = new MediaStream([audioClone]);

            // Audio Level Detection — only send chunk if speech was detected
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(audioStream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            let isSpeakingInSegment = false;
            const checkVolume = () => {
                if (!isTranscriptionEnabled) return;
                analyser.getByteFrequencyData(dataArray);
                const volume = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
                if (volume > 15) {
                    isSpeakingInSegment = true;
                }
                requestAnimationFrame(checkVolume);
            };
            checkVolume();

            const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = async (event) => {
                // Only send to backend if there was actual speech in this segment
                if (event.data.size > 0 && socket && meetingId && isSpeakingInSegment) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        socket.emit('audio_chunk', {
                            meetingId,
                            participantId: user?.id || 'guest',
                            participantName: user?.name || 'Guest',
                            audioBlob: reader.result
                        });
                        isSpeakingInSegment = false; // Reset for next segment
                    };
                    reader.readAsArrayBuffer(event.data);
                }
            };

            const recordSegment = () => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                    recorder.start();
                }
            };

            recorder.start();
            const interval = setInterval(recordSegment, 3000);

            return () => {
                clearInterval(interval);
                audioCtx.close();
                if (recorder.state !== 'inactive') recorder.stop();
                audioStream.getTracks().forEach(t => t.stop());
            };
        } catch (err) {
            console.error('Failed to start transcription recorder:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        }
    };

    return null; // This is a manager component, no UI
}
