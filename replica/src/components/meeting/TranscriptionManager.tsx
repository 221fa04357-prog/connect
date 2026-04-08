import { useEffect, useRef } from 'react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useChatStore } from '@/stores/useChatStore';

export function TranscriptionManager() {
    const { localStream, rawStream, isAudioMuted, meeting } = useMeetingStore();
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
    const translationQueueRef = useRef<Promise<any>>(Promise.resolve());

    // Listen for transcription results from the shared socket
    // REMOVED `isTranscriptionEnabled` from the array logic so that ALL users get incoming captions!
    useEffect(() => {
        if (!socket) return;

        const translateText = async (text: string, targetLang: string, sourceLang?: string) => {
            // Edge case: Same language -> skip translation network call
            if (sourceLang && targetLang.toLowerCase() === sourceLang.toLowerCase()) {
                return text;
            }

            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/translate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, targetLang })
                });
                if (response.ok) {
                    const data = await response.json();
                    return data.text || text;
                }
                return text;
            } catch (err) {
                console.error('[Translation] Proxy error:', err);
                return text;
            }
        };

        const handleTranscription = (data: any) => {
            if (data.text) {
                const { translationLanguage } = useTranscriptionStore.getState();
                const sourceLanguage = data.language || 'English';
                
                // Chain the processing to the translation queue to preserve order
                translationQueueRef.current = translationQueueRef.current.then(async () => {
                    let finalText;

                    if (translationLanguage === 'Original') {
                        // ONLY use raw captions if 'Original' is selected
                        finalText = data.text;
                    } else {
                        // All other language selections go through the translation flow
                        console.log(`[Translation] Processing for ${translationLanguage}...`);
                        finalText = await translateText(data.text, translationLanguage, sourceLanguage);
                    }

                    console.log('%c[Transcription] Displaying: ' + finalText, 'color: #0B5CFF; font-weight: bold;');
                    handleNewTranscription(finalText, data.participantName || 'Guest', data.participantId, data.role);
                }).catch(err => {
                    console.error('[Translation] Queue error:', err);
                    // Fallback choice: If the system is set to translate, we still try to show the result
                    // but on error we use the raw text to ensure captions stay visible
                    handleNewTranscription(data.text, data.participantName || 'Guest', data.participantId, data.role);
                });
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
        
        // Only show live captions on screen if transcription UI is enabled
        const isTranscriptionEnabled = useTranscriptionStore.getState().isTranscriptionEnabled;
        if (isTranscriptionEnabled) {
            setCurrentCaption(text.trim(), speakerName, roleToUse);

            if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
            captionTimerRef.current = setTimeout(() => {
                clearCurrentCaption();
            }, 3000); // Hide after 3s of silence
        }
    };

    const isCaptionsAllowed = meeting?.settings?.captionsAllowed !== false;

    // React to captions being disabled globally (only affects UI toggle now)
    useEffect(() => {
        if (!isCaptionsAllowed && isTranscriptionEnabled) {
            setTranscriptionEnabled(false);
            import('sonner').then(({ toast }) => toast.info('The host has disabled closed captions.'));
        }
    }, [isCaptionsAllowed, isTranscriptionEnabled, setTranscriptionEnabled]);

    const startRecording = () => {
        if (mediaRecorderRef.current || !rawStream) {
            console.log('[Transcription] Cannot start: ', { 
                hasRecorder: !!mediaRecorderRef.current, 
                hasStream: !!rawStream 
            });
            return;
        }

        try {
            const tracks = rawStream.getAudioTracks();
            console.log(`[Transcription] Audio tracks found: ${tracks.length}`);
            tracks.forEach((t, i) => {
                console.log(`[Transcription] Track [${i}]: id=${t.id}, label=${t.label}, enabled=${t.enabled}, muted=${t.muted}, state=${t.readyState}`);
            });

            const audioTrack = tracks[0];
            if (!audioTrack) {
                console.warn('[Transcription] No audio track found in localStream');
                return;
            }

            // 1. Setup AudioContext and Analyser directly on raw microphone stream
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(rawStream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let isSpeakingInSegment = false;
            let currentAverageVolume = 0;
            let speakingFramesThreshold = 3; // ~50ms (more responsive)
            let speakingFramesCount = 0;

            const checkVolume = () => {
                if (!audioCtx || audioCtx.state === 'closed') return;
                
                analyser.getByteTimeDomainData(dataArray);
                
                let sumSquares = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const normalized = (dataArray[i] - 128) / 128;
                    sumSquares += normalized * normalized;
                }
                const rms = Math.sqrt(sumSquares / dataArray.length);
                currentAverageVolume = rms * 100; // Scale to 0-100
                (window as any)._lastVadRms = currentAverageVolume;

                // Sensitivity threshold: 0.3 (Lowered to capture even quiet initial greetings)
                if (currentAverageVolume > 0.3) {
                    speakingFramesCount++;
                    if (speakingFramesCount >= speakingFramesThreshold) {
                    isSpeakingInSegment = true;
                }
            } else {
                speakingFramesCount = Math.max(0, speakingFramesCount - 1);
            }
                
                requestAnimationFrame(checkVolume);
            };
            checkVolume();

            // Log volume periodically for debugging
            const logVolumeInterval = setInterval(() => {
                const muteState = useMeetingStore.getState().isAudioMuted;
                const captionsOn = useTranscriptionStore.getState().isTranscriptionEnabled;
                const lang = useTranscriptionStore.getState().speakingLanguage;
                console.log(`[Transcription] VAD: rms=${currentAverageVolume.toFixed(2)}, frames=${speakingFramesCount}, speaking=${isSpeakingInSegment}, mute=${muteState}, uiEnabled=${captionsOn}, lang=${lang} (Recording active for AI)`);
            }, 3000);

            // 2. Setup MediaRecorder with supported mimeType
            const getSupportedMimeType = () => {
                const types = [
                    'audio/webm;codecs=opus',
                    'audio/webm',
                    'audio/ogg;codecs=opus',
                    'audio/wav',
                    'audio/x-matroska;codecs=opus',
                    'audio/mp4'
                ];
                for (const t of types) {
                    if (MediaRecorder.isTypeSupported(t)) return t;
                }
                return '';
            };

            const selectedMimeType = getSupportedMimeType();
            console.log(`[Transcription] Selected MIME type: ${selectedMimeType || 'default'}`);

            // Use only audio tracks to avoid issues with video tracks in rawStream
            const audioStream = new MediaStream(rawStream.getAudioTracks());
            const recorder = new MediaRecorder(audioStream, selectedMimeType ? { mimeType: selectedMimeType } : undefined);
            
            mediaRecorderRef.current = recorder;

            // Prevent GC and provide debug access
            (recorder as any)._debugNodes = { audioCtx, source, analyser };

            recorder.ondataavailable = async (event) => {
                const hasData = event.data.size > 0;
                const forceSend = (window as any)._forceTranscription === true;
                const muteState = useMeetingStore.getState().isAudioMuted;

                console.log(`[Transcription] chunk ready: ${event.data.size}b, spoke: ${isSpeakingInSegment} (force=${forceSend}, mute=${muteState})`);

                if (hasData) {
                    // Only send if NOT muted and speech detected
                    if (!muteState && (isSpeakingInSegment || forceSend)) {

                        const speakingLanguage = useTranscriptionStore.getState().speakingLanguage;
                        const isHost = useMeetingStore.getState().isJoinedAsHost;
                        const role = isHost ? 'host' : 'participant';
                        const meetingId = meeting?.id || '';

                        console.log(`[Transcription] POSTing chunk (lang=${speakingLanguage}, role=${role})...`);

                        const formData = new FormData();
                        formData.append('audio', event.data, 'segment.webm');
                        formData.append('meetingId', meetingId);
                        formData.append('participantId', user?.id || 'guest');
                        formData.append('participantName', user?.name || 'Guest');
                        formData.append('language', speakingLanguage);
                        formData.append('role', role);

                        try {
                            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transcribe`, {
                                method: 'POST',
                                body: formData
                            });

                            if (response.ok) {
                                if (response.status === 204) return;

                                const data = await response.json();
                                if (data.text) {
                                    console.log(`[Transcription] Result: "${data.text}"`);
                                }
                            } else {
                                const errText = await response.text();
                                console.error(`[Transcription] API error ${response.status}:`, errText);
                            }

                        } catch (err) {
                            console.error('[Transcription] Request failed:', err);
                        }

                    } else if (muteState) {
                        console.log('[Transcription] Suppressing chunk: Microphone is muted.');
                    } else {
                        console.log('[Transcription] Suppressing chunk: No speech detected.');
                    }

                    // Reset speaking flag
                    isSpeakingInSegment = false;
                }
            };

            recorder.onstop = () => {
                // Restart immediately to keep capturing audio for AI, regardless of UI toggle
                if (mediaRecorderRef.current === recorder && !useMeetingStore.getState().isAudioMuted) {
                    try { 
                        if (recorder.state === 'inactive') recorder.start(); 
                    } catch(e) {
                        console.warn('[Transcription] Failed to restart recorder:', e);
                    }
                }
            };

            // Initial start
            if (recorder.state === 'inactive') {
                recorder.start();
            }

            // Instead of timeslice, we stop and restart every 5 seconds to force a new valid file
            // Increased to 5s for better acoustic context in Whisper
            const segmentInterval = setInterval(() => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
            }, 5000);

            return () => {
                clearInterval(logVolumeInterval);
                clearInterval(segmentInterval);
                mediaRecorderRef.current = null;
                if (recorder.state !== 'inactive') recorder.stop();
                if (audioCtx.state !== 'closed') audioCtx.close();
            };
        } catch (err) {
            console.error('Failed to start transcription recorder:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
    };

    // We only START the recorder if local stream exists and mic is NOT muted.
    // Requirement #8: Capture when mic is ON, even if captions are disabled (for AI Companion).
    useEffect(() => {
        if (!rawStream || isAudioMuted) {
            stopRecording();
            return;
        }
        const cleanup = startRecording();
        return () => {
            stopRecording();
            if (typeof cleanup === 'function') cleanup();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localStream, isAudioMuted]);

    // We no longer return null early based on isCaptionsAllowed to ensure the component stays mounted
    // and continues handling the startRecording lifecycle via useEffect.
    return null;
}
