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
        }, 3000); // Hide after 3s of silence (snappier responsive feeling)
    };

    const isCaptionsAllowed = meeting?.settings?.captionsAllowed !== false;

    // React to captions being disabled globally
    useEffect(() => {
        if (!isCaptionsAllowed && isTranscriptionEnabled) {
            setTranscriptionEnabled(false);
            import('sonner').then(({ toast }) => toast.info('The host has disabled closed captions.'));
        }
    }, [isCaptionsAllowed, isTranscriptionEnabled, setTranscriptionEnabled]);

    const startRecording = () => {
        if (mediaRecorderRef.current || !localStream) {
            console.log('[Transcription] Cannot start: ', { 
                hasRecorder: !!mediaRecorderRef.current, 
                hasStream: !!localStream 
            });
            return;
        }

        try {
            const tracks = localStream.getAudioTracks();
            console.log(`[Transcription] Audio tracks found: ${tracks.length}`);
            tracks.forEach((t, i) => {
                console.log(`[Transcription] Track [${i}]: id=${t.id}, label=${t.label}, enabled=${t.enabled}, muted=${t.muted}, state=${t.readyState}`);
            });

            const audioTrack = tracks[0];
            if (!audioTrack) {
                console.warn('[Transcription] No audio track found in localStream');
                return;
            }

            // 1. Setup AudioContext and Analyser directly on localStream
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(localStream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
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
                console.log(`[Transcription] VAD: rms=${currentAverageVolume.toFixed(2)}, frames=${speakingFramesCount}, speaking=${isSpeakingInSegment}, mute=${muteState}, uiEnabled=${captionsOn}, lang=${lang}`);
            }, 3000);

            // 2. Setup MediaRecorder
            const recorder = new MediaRecorder(localStream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorderRef.current = recorder;

            // Prevent GC and provide debug access
            (recorder as any)._debugNodes = { audioCtx, source, analyser };

            recorder.ondataavailable = async (event) => {
                const hasData = event.data.size > 0;
                const forceSend = (window as any)._forceTranscription === true;
                const muteState = useMeetingStore.getState().isAudioMuted;
                
                console.log(`[Transcription] chunk ready: ${event.data.size}b, spoke: ${isSpeakingInSegment} (force=${forceSend}, mute=${muteState})`);
                
                if (hasData) {
                    // CRITICAL: Requirement #8 - Only send to Whisper if NOT muted and we detected speech
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
                                if (data.text) console.log(`[Transcription] Result: "${data.text}"`);
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
                    
                    // Always reset speaking flag for next segment
                    isSpeakingInSegment = false;
                }
            };

            recorder.onstop = () => {
                // Restart immediately if still enabled - ignore mute so we keep signal monitoring alive
                if (mediaRecorderRef.current === recorder && isTranscriptionEnabled && isCaptionsAllowed) {
                    try { recorder.start(); } catch(e) {}
                }
            };

            // Initial start
            recorder.start();

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

    // We only START the recorder if local transcription is enabled AND allowed globally!
    // Requirement #8: Only capture when mic is ON and captions are enabled.
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

    if (!isCaptionsAllowed && !isTranscriptionEnabled) return null;

    return null;
}
