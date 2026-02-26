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

        const handleAllTranscripts = (segments: any[]) => {
            if (Array.isArray(segments)) {
                useTranscriptionStore.getState().setTranscripts(segments.slice(-50));
            }
        };

        socket.on('transcription_received', handleTranscription);
        socket.on('all_transcripts', handleAllTranscripts);

        // Fetch existing history if we are joining late
        if (meetingId) {
            socket.emit('get_transcripts', { meetingId });
        }

        return () => {
            socket.off('transcription_received', handleTranscription);
            socket.off('all_transcripts', handleAllTranscripts);
            if (captionTimerRef.current) {
                clearTimeout(captionTimerRef.current);
            }
        };
    }, [socket, meetingId, addTranscript, setCurrentCaption, clearCurrentCaption]);

    // Start/stop VAD logic is now handled in the startVAD useEffect below


    // Clear caption when transcription is disabled
    useEffect(() => {
        if (!isTranscriptionEnabled) {
            clearCurrentCaption();
            if (captionTimerRef.current) {
                clearTimeout(captionTimerRef.current);
            }
        }
    }, [isTranscriptionEnabled, clearCurrentCaption]);

    const vadRef = useRef<{
        audioCtx: AudioContext;
        analyser: AnalyserNode;
        source: MediaStreamAudioSourceNode;
        dataArray: Float32Array;
        isSpeaking: boolean;
        checkInterval: number;
    } | null>(null);

    const recordingStoppedManuallyRef = useRef<boolean>(false);

    const startVAD = (stream: MediaStream) => {
        if (vadRef.current) return;

        try {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);

            let silenceStart: number | null = null;
            const SPEECH_THRESHOLD = 0.02; // RMS threshold
            const SILENCE_DURATION = 1000; // Stop after 1s of silence

            const checkVAD = () => {
                if (!isTranscriptionEnabled || isAudioMuted) {
                    stopRecording();
                    return;
                }

                analyser.getFloatTimeDomainData(dataArray);

                // Calculate RMS (Root Mean Square)
                let sumSquares = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sumSquares += dataArray[i] * dataArray[i];
                }
                const rms = Math.sqrt(sumSquares / bufferLength);

                const isCurrentlySpeaking = rms > SPEECH_THRESHOLD;

                if (isCurrentlySpeaking) {
                    silenceStart = null;
                    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                        console.log('VAD: Speech detected. Starting recording.');
                        startRecordingBurst(stream);
                    }
                } else {
                    if (silenceStart === null) {
                        silenceStart = Date.now();
                    } else if (Date.now() - silenceStart > SILENCE_DURATION) {
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                            console.log('VAD: 1s of silence. Stopping burst.');
                            mediaRecorderRef.current.stop();
                        }
                    }
                }

                vadRef.current!.checkInterval = requestAnimationFrame(checkVAD);
            };

            vadRef.current = {
                audioCtx,
                analyser,
                source,
                dataArray,
                isSpeaking: false,
                checkInterval: requestAnimationFrame(checkVAD)
            };
        } catch (err) {
            console.error('VAD setup failed:', err);
        }
    };

    const stopVAD = () => {
        if (vadRef.current) {
            cancelAnimationFrame(vadRef.current.checkInterval);
            vadRef.current.audioCtx.close();
            vadRef.current = null;
        }
    };

    const startRecordingBurst = (stream: MediaStream) => {
        if (mediaRecorderRef.current?.state === 'recording') return;

        // Ensure track is active and constraints applied
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        // Apply strict constraints if possible (though they should already be on localStream)
        audioTrack.applyConstraints({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }).catch(() => { });

        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket && meetingId) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Send to backend via WebSocket — ONLY IF SPEECH WAS DETECTED (Already filtered by VAD logic above)
                    socket.emit('audio_chunk', {
                        meetingId,
                        participantId: user?.id || 'guest',
                        participantName: user?.name || 'Guest',
                        audioBlob: reader.result,
                        timestamp: new Date().toISOString()
                    });
                };
                reader.readAsArrayBuffer(event.data);
            }
        };

        recorder.onstop = () => {
            // If the user hasn't stopped transcription entirely, restart if VAD still detects speech
            // This is handled by the checkVAD interval.
        };

        // Standard segmenting while speech is active (to keep response time low)
        recorder.start(2000);
    };

    useEffect(() => {
        if (!isTranscriptionEnabled || !localStream || !socket || !meetingId || isAudioMuted) {
            stopRecording();
            stopVAD();
            return;
        }

        startVAD(localStream);

        return () => {
            stopVAD();
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

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            mediaRecorderRef.current = null;
        }
    };

    return null; // This is a manager component, no UI
}
