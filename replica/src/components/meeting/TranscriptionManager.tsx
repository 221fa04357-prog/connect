import { useEffect, useRef } from 'react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';

export function TranscriptionManager() {
    const { localStream, isAudioMuted } = useMeetingStore();
    const { user } = useAuthStore();
    const {
        addTranscript,
        isTranscriptionEnabled,
        setCurrentCaption,
        clearCurrentCaption,
        speakingLanguage
    } = useTranscriptionStore();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initialize WebSocket for real-time transcription
    useEffect(() => {
        let isActive = true;

        const connectWS = () => {
            if (!isTranscriptionEnabled || !isActive) return;

            if (socketRef.current) {
                socketRef.current.onclose = null; // Prevent recursion
                socketRef.current.close();
                socketRef.current = null;
            }

            const hostname = window.location.hostname || 'localhost';
            const langParam = speakingLanguage ? `?lang=${encodeURIComponent(speakingLanguage.toLowerCase())}` : '';
            const ws = new WebSocket(`ws://${hostname}:8765/transcribe-ws${langParam}`);
            socketRef.current = ws;

            ws.onopen = () => {
                console.log(`[Transcription] WebSocket Connected (${speakingLanguage}) ✓`);
                // Clear and start heartbeat to keep connection alive during silence
                if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
                heartbeatTimerRef.current = setInterval(() => {
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                        try {
                            // Send a small dummy byte to keep the connection alive
                            socketRef.current.send(new Uint8Array([0x00]));
                        } catch (e) {
                            console.warn('[Transcription] Heartbeat failed');
                        }
                    }
                }, 15000); // 15s heartbeat
            };

            ws.onmessage = (event) => {
                if (!isActive) return;
                try {
                    const data = JSON.parse(event.data);
                    if (data.text) {
                        console.log('%c[Transcription] Received Text: ' + data.text, 'color: #0B5CFF; font-weight: bold;');
                        handleNewTranscription(data.text);
                    }
                } catch (e) {
                    // Ignore ping reflections or malformed JSON
                }
            };

            ws.onclose = (e) => {
                if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
                if (isActive && isTranscriptionEnabled) {
                    console.log(`[Transcription] WS Closed (Code: ${e.code}). Reconnecting in 2s...`);
                    setTimeout(() => {
                        if (isActive && isTranscriptionEnabled) connectWS();
                    }, 2000);
                }
            };

            ws.onerror = (err) => console.error('[Transcription] WS Connection Error:', err);
        };

        if (isTranscriptionEnabled) connectWS();

        return () => {
            isActive = false;
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            if (socketRef.current) {
                socketRef.current.onclose = null;
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [isTranscriptionEnabled, speakingLanguage]);

    const handleNewTranscription = (text: string) => {
        if (!text || text.trim().length === 0) return;

        addTranscript({
            participantId: user?.id || 'guest',
            participantName: user?.name || 'Guest',
            text: text.trim(),
            timestamp: new Date().toISOString()
        });

        const speakerName = user?.name || 'Guest';
        const isHost = useMeetingStore.getState().isJoinedAsHost;
        const speakerRole = isHost ? 'host' : 'participant';

        setCurrentCaption(text.trim(), speakerName, speakerRole);


        if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
        captionTimerRef.current = setTimeout(() => {
            clearCurrentCaption();
        }, 7000);
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
        if (mediaRecorderRef.current || !localStream) return;

        try {
            const audioTrack = localStream.getAudioTracks()[0];
            if (!audioTrack) return;

            // Apply noise suppression at the hardware level
            audioTrack.applyConstraints({
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }).catch(e => console.warn('[Transcription] Constraints fail:', e));

            const audioStream = new MediaStream([audioTrack.clone()]);
            const audioCtx = new AudioContext();

            let isSpeakingInSegment = false;
            let currentPeak = 0;

            const startChunk = () => {
                if (!isTranscriptionEnabled || !localStream || isAudioMuted) return;

                // Ensure AudioContext is active
                if (audioCtx.state === 'suspended') audioCtx.resume();

                const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });
                mediaRecorderRef.current = recorder;

                recorder.ondataavailable = (event) => {
                    if (isSpeakingInSegment && event.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current?.send(event.data);
                    } else if (event.data.size > 0) {
                        // Silent chunk gated
                    }
                    isSpeakingInSegment = false;
                };

                recorder.start();

                chunkTimerRef.current = setTimeout(() => {
                    if (recorder.state === 'recording') {
                        recorder.stop();
                        startChunk();
                    }
                }, 1500); // 1.5s is more stable for WebM headers
            };

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            audioCtx.createMediaStreamSource(audioStream).connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkVolume = () => {
                if (!isTranscriptionEnabled) return;
                analyser.getByteFrequencyData(dataArray);
                currentPeak = Math.max(...Array.from(dataArray));
                if (currentPeak > 35) isSpeakingInSegment = true;
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
