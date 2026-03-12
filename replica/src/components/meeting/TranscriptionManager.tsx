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
        setTranscriptionEnabled,
        setCurrentCaption,
        clearCurrentCaption,
    } = useTranscriptionStore();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Listen for transcription results from the shared socket
    // REMOVED `isTranscriptionEnabled` from the array logic so that ALL users get incoming captions!
    useEffect(() => {
        if (!socket) return;

        const handleTranscription = (data: any) => {
            if (data.text) {
                console.log('%c[Transcription] Received: ' + data.text, 'color: #0B5CFF; font-weight: bold;');
                handleNewTranscription(data.text, data.participantName || 'Guest', data.participantId, data.role);
            }
        };

        socket.on('transcription_received', handleTranscription);
        return () => {
            socket.off('transcription_received', handleTranscription);
        };
    }, [socket]);

    const handleNewTranscription = (text: string, speakerName: string, speakerId?: string, speakerRole?: 'host' | 'participant') => {
        if (!text || text.trim().length === 0) return;

        addTranscript({
            participantId: speakerId || 'guest',
            participantName: speakerName,
            text: text.trim(),
            timestamp: new Date().toISOString()
        });

        const roleToUse = speakerRole || 'participant';
        setCurrentCaption(text.trim(), speakerName, roleToUse);

        if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
        captionTimerRef.current = setTimeout(() => {
            clearCurrentCaption();
        }, 5000); // Hide after 5s of silence
    };

    const isCaptionsAllowed = meeting?.settings?.captionsAllowed !== false;

    // React to captions being disabled globally
    useEffect(() => {
        if (!isCaptionsAllowed && isTranscriptionEnabled) {
            setTranscriptionEnabled(false);
            import('sonner').then(({ toast }) => toast.info('The host has disabled closed captions.'));
        }
    }, [isCaptionsAllowed, isTranscriptionEnabled, setTranscriptionEnabled]);

    // We only START the recorder if local transcription is enabled AND allowed globally!
    useEffect(() => {
        if (!isTranscriptionEnabled || !isCaptionsAllowed || !localStream || isAudioMuted) {
            stopRecording();
            return;
        }
        const cleanup = startRecording();
        return () => {
            stopRecording();
            if (typeof cleanup === 'function') cleanup();
        };
    }, [isTranscriptionEnabled, isCaptionsAllowed, localStream, isAudioMuted]);

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
                if (!isTranscriptionEnabled || !isCaptionsAllowed || !localStream || isAudioMuted || !socket) return;

                if (audioCtx.state === 'suspended') audioCtx.resume();

                const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });
                mediaRecorderRef.current = recorder;

                recorder.ondataavailable = async (event) => {
                    const speakingLanguage = useTranscriptionStore.getState().speakingLanguage;
                    if (isSpeakingInSegment && event.data.size > 0 && socket.connected) {
                        try {
                            const formData = new FormData();
                            formData.append('audio', event.data, `audio_${Date.now()}.webm`);
                            formData.append('meetingId', meeting?.id || '');
                            formData.append('participantId', user?.id || 'guest');
                            formData.append('participantName', user?.name || 'Guest');
                            formData.append('language', speakingLanguage || 'en');

                            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transcribe`, {
                                method: 'POST',
                                body: formData
                            });
                        } catch (err) {
                            console.error('[Transcription] Error sending audio chunk via HTTP:', err);
                        }
                    }
                    isSpeakingInSegment = false;
                };

                recorder.start();

                chunkTimerRef.current = setTimeout(() => {
                    if (recorder.state === 'recording') {
                        recorder.stop();
                        // Request next chunk immediately
                        requestAnimationFrame(startChunk);
                    }
                }, 3000); // 3.0s chunks give Whisper more context for better accuracy
            };

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            audioCtx.createMediaStreamSource(audioStream).connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkVolume = () => {
                if (!isTranscriptionEnabled || !audioCtx) return;
                analyser.getByteFrequencyData(dataArray);
                const peak = Math.max(...Array.from(dataArray));
                if (peak > 3) isSpeakingInSegment = true; // Even more sensitive (3 vs 5) to catch brief words like "Hi"
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

    if (!isCaptionsAllowed && !isTranscriptionEnabled) return null;

    return null;
}
