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
        speakingLanguage
    } = useTranscriptionStore();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Listen for transcription results from the central Node.js server (Socket.io)
    // Removed `isTranscriptionEnabled` from the dependency and condition so ALL participants can see captions!
    // As long as ONE person has transcription enabled and speaks, the server broadcasts it.
    useEffect(() => {
        if (!socket) return;

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
    }, [isTranscriptionEnabled, localStream, isAudioMuted, speakingLanguage]);

    const startRecording = () => {
        if (mediaRecorderRef.current || !localStream || !socket) return;

        // Vercel / Production environment variable check
        let wsUrl = import.meta.env.VITE_TRANSCRIBE_WS_URL || 'ws://127.0.0.1:8765/transcribe';

        // Append language preference if user selected one
        if (speakingLanguage) {
            const separator = wsUrl.includes('?') ? '&' : '?';
            wsUrl += `${separator}lang=${encodeURIComponent(speakingLanguage.toLowerCase())}`;
        }

        let captionWs: WebSocket | null = new WebSocket(wsUrl);
        captionWs.onopen = () => console.log('[Transcription] Connected to raw Whisper WS: ' + wsUrl);

        captionWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.text) {
                // Whisper translated the audio. NOW broadcast it to everyone in the room via Socket.io!
                socket.emit('broadcast_transcription', {
                    meetingId: meeting?.id,
                    participantId: user?.id || 'guest',
                    participantName: user?.name || 'Guest',
                    text: data.text
                });
            }
        };

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
                    if (isSpeakingInSegment && event.data.size > 0 && captionWs?.readyState === WebSocket.OPEN) {
                        try {
                            const buffer = await event.data.arrayBuffer();
                            captionWs.send(buffer);
                        } catch (err) {
                            console.warn("Failed to send WS audio chunk", err);
                        }
                    }
                    isSpeakingInSegment = false;
                };

                recorder.start();

                chunkTimerRef.current = setTimeout(() => {
                    if (recorder.state === 'recording') {
                        recorder.stop();
                        startChunk();
                    }
                }, 2000); // 2.0s chunks to allow full sentence fragments
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

            // Start repeating chunks
            startChunk();

            // Heartbeat loop for the caption websocket
            const heartbeat = setInterval(() => {
                if (captionWs && captionWs.readyState === WebSocket.OPEN) {
                    try { captionWs.send(new Uint8Array([0x00])); } catch (e) { }
                }
            }, 15000);

            return () => {
                clearInterval(heartbeat);
                if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
                mediaRecorderRef.current = null;
                audioCtx.close();
                audioStream.getTracks().forEach(t => t.stop());
                if (captionWs) {
                    captionWs.close();
                    captionWs = null;
                }
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
