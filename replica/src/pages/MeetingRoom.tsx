import { useEffect, useState, useRef, useCallback } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { VideoGrid } from '@/components/meeting/MeetingVideo';
import MeetingControls from '@/components/meeting/MeetingControls';
import { ChatPanel, ParticipantsPanel, AICompanionPanel } from '@/components/meeting/MeetingLayout';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useChatStore } from '@/stores/useChatStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { useMediaStore } from '@/stores/useMediaStore';
import { useAIStore } from '@/stores/useAIStore';
import { useNavigate } from 'react-router-dom';

export default function MeetingRoom() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const {
    participants,
    setActiveSpeaker,
    waitingRoom,
    admitFromWaitingRoom,
    removeFromWaitingRoom,
    setVideoRestriction,
    updateParticipant,
    activeSpeakerId
  } = useParticipantsStore();

  const {
    meeting,
    reactions,
    removeReaction,
    isRecording,
    recordingStartTime,
    localStream,
    setLocalStream,
    screenShareStream,
    isAudioMuted: meetingStoreAudioMuted,
    isVideoOff: meetingStoreVideoOff,
    connectionQuality,
    setConnectionQuality,
    isJoinedAsHost,
    hasHydrated
  } = useMeetingStore();

  const { initSocket, emitParticipantUpdate, emitReaction } = useChatStore();
  const { addRemoteStream, addRemoteScreenStream, removeRemoteStream, clearRemoteStreams } = useMediaStore();
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  /* ---------------- SIGNALING STATE ---------------- */
  const makingOfferRef = useRef<Record<string, boolean>>({});
  const ignoreOfferRef = useRef<Record<string, boolean>>({});
  const isSettingRemoteAnswerPending = useRef<Record<string, boolean>>({});
  const screenShareSendersRef = useRef<Record<string, RTCRtpSender[]>>({}); // socketId -> senders[]

  const createPeerConnection = useCallback((participantSocketId: string, isPolite: boolean) => {
    if (peerConnections.current[participantSocketId]) return peerConnections.current[participantSocketId];

    console.log(`Creating PeerConnection for ${participantSocketId} (Polite: ${isPolite})`);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ]
    });

    pc.onnegotiationneeded = async () => {
      try {
        // Only initiate if state is stable to avoid transition errors
        if (pc.signalingState !== 'stable') return;
        makingOfferRef.current[participantSocketId] = true;
        await pc.setLocalDescription();
        console.log(`Sending OFFER to ${participantSocketId}`);
        useChatStore.getState().socket?.emit('signal_send', {
          to: participantSocketId,
          from: useChatStore.getState().socket?.id,
          signal: pc.localDescription
        });
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOfferRef.current[participantSocketId] = false;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        useChatStore.getState().socket?.emit('signal_send', {
          to: participantSocketId,
          from: useChatStore.getState().socket?.id,
          signal: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      const participant = useParticipantsStore.getState().participants.find(p => p.socketId === participantSocketId);

      // Robust check: if participant is known to be sharing AND this stream ID matches, OR if it's a second video stream
      const isScreenTrack = (participant?.isScreenSharing && participant.screenShareStreamId === stream.id);

      if (isScreenTrack) {
        console.log(`Identified SCREEN SHARE stream from ${participantSocketId}`);
        addRemoteScreenStream(participantSocketId, stream);
      } else {
        console.log(`Identified CAMERA/AUDIO stream from ${participantSocketId}`);
        addRemoteStream(participantSocketId, stream);
      }
    };

    // Add local tracks if they exist
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Add screen share tracks if they exist
    const currentScreenShare = useMeetingStore.getState().screenShareStream;
    if (currentScreenShare) {
      console.log(`Adding existing screen share tracks to new PC for ${participantSocketId}`);
      const senders: RTCRtpSender[] = [];
      currentScreenShare.getTracks().forEach(track => {
        const sender = pc.addTrack(track, currentScreenShare);
        senders.push(sender);
      });
      screenShareSendersRef.current[participantSocketId] = senders;
    }

    peerConnections.current[participantSocketId] = pc;
    return pc;
  }, [localStream, addRemoteStream]);

  // Reset AI store if meeting ID changed (isolation)
  useEffect(() => {
    if (meeting?.id) {
      const aiStore = useAIStore.getState();
      if (aiStore.currentMeetingId !== meeting.id) {
        console.log('MeetingRoom: Meeting ID changed, resetting AI Companion and Participants state');
        aiStore.reset();
        aiStore.setCurrentMeetingId(meeting.id);

        // Also reset participants and chat store to avoid phantoms and stale history
        useParticipantsStore.getState().reset();
        useChatStore.getState().reset();
      }
    }
  }, [meeting?.id]);

  /* ---------------- CHAT & SIGNALING INITIALIZATION ---------------- */
  useEffect(() => {
    // FIX: Allow guests (user is null) to init socket
    if (meeting?.id) {
      // Try to find existing guest participant to get ID/Name
      const existingGuest = participants.find(p => p.id.startsWith('guest-'));

      const isJoinedAsHost = useMeetingStore.getState().isJoinedAsHost;
      const identity = user ? {
        id: user.id,
        name: user.name || 'Anonymous',
        role: isJoinedAsHost ? 'host' : 'participant'
      } : {
        id: existingGuest?.id || `guest-${Math.random().toString(36).substr(2, 9)}`,
        name: existingGuest?.name || 'Guest',
        role: isJoinedAsHost ? 'host' : 'participant'
      };

      console.log('MeetingRoom: Initializing chat socket for meeting:', meeting.id, identity, { isJoinedAsHost });

      // Capture current media state to send as initial state
      const initialState = {
        isAudioMuted: useMeetingStore.getState().isAudioMuted,
        isVideoOff: useMeetingStore.getState().isVideoOff,
        isHandRaised: false
      };

      if (hasHydrated) {
        initSocket(meeting.id, identity, initialState);
      }

      const socket = useChatStore.getState().socket;
      if (socket) {

        // Handle join errors (including MEETING_ENDED)
        socket.on('join_error', (error: any) => {
          console.error('Join Error:', error);
          if (error.code === 'MEETING_NOT_STARTED') {
            import('sonner').then(({ toast }) => {
              toast.error(error.message, {
                description: `Scheduled start: ${new Date(Number(error.startTime)).toLocaleString()}`,
                duration: 5000,
              });
            });
            navigate('/');
          } else if (error.code === 'MEETING_ENDED') {
            import('sonner').then(({ toast }) => {
              toast.error(error.message, {
                description: 'This meeting is no longer active.',
                duration: 5000,
              });
            });
            navigate('/');
          }
        });

        // Handle incoming signals using Perfect Negotiation
        socket.on('signal_receive', async (data: { from: string, signal: any }) => {
          const { from, signal } = data;
          const socketId = socket.id;
          if (!socketId) return;

          // Politeness: The "polite" peer rolls back if collisions happen.
          // Stable rule: Peer with the "smaller" ID is polite.
          const isPolite = socketId < from;

          try {
            let pc = peerConnections.current[from];

            if (!pc) {
              pc = createPeerConnection(from, isPolite);
            }

            if (signal.type === 'offer') {
              const offerCollision = makingOfferRef.current[from] || pc.signalingState !== "stable";
              ignoreOfferRef.current[from] = !isPolite && offerCollision;

              if (ignoreOfferRef.current[from]) {
                console.log("Glare detected: Ignoring offer from", from);
                return;
              }

              console.log(`Received OFFER from ${from} (Polite: ${isPolite})`);
              await pc.setRemoteDescription(new RTCSessionDescription(signal));
              await pc.setLocalDescription();

              useChatStore.getState().socket?.emit('signal_send', {
                to: from,
                from: socketId,
                signal: pc.localDescription
              });
            } else if (signal.type === 'answer') {
              console.log(`Received ANSWER from ${from}`);
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
              } else {
                console.warn(`Ignored ANSWER from ${from} because state is ${pc.signalingState}`);
              }
            } else if (signal.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal));
              } catch (err) {
                if (!ignoreOfferRef.current[from]) {
                  console.error("Error adding ICE candidate:", err);
                }
              }
            }
          } catch (err) {
            console.error("Signaling error for peer", from, ":", err);
          }
        });
      }
    }
  }, [meeting?.id, user, initSocket, createPeerConnection, hasHydrated]);

  const { localUserId } = useChatStore();

  // Sync local participant state with MeetingStore when joining
  useEffect(() => {
    if (meeting?.id && participants.length > 0) {
      const myParticipant = participants.find(p => p.id === localUserId) ||
        (user ? participants.find(p => p.id === user.id) : null);

      if (myParticipant) {
        // Update participant to match MeetingStore state
        if (myParticipant.isVideoOff !== meetingStoreVideoOff || myParticipant.isAudioMuted !== meetingStoreAudioMuted) {
          updateParticipant(myParticipant.id, {
            isVideoOff: meetingStoreVideoOff,
            isAudioMuted: meetingStoreAudioMuted
          });
        }
      }
    }
  }, [meeting?.id, user, participants, meetingStoreVideoOff, meetingStoreAudioMuted, updateParticipant]);

  // Handle new participants joining (initiate negotiation)
  useEffect(() => {
    const socket = useChatStore.getState().socket;
    if (socket) {
      participants.forEach(p => {
        // @ts-ignore - p.socketId comes from backend rooms Map
        if (p.socketId && p.socketId !== socket.id && !peerConnections.current[p.socketId]) {
          // Only initiate if we don't have a connection yet.
          // Note: In Perfect Negotiation, both sides CAN start, but usually we let the "impolite" one strictly offering isn't required if we handle collision.
          // However, to kickstart:
          const isPolite = socket.id < p.socketId;
          createPeerConnection(p.socketId, isPolite);
        }
      });
    }
  }, [participants, createPeerConnection]);

  // DYNAMIC TRACK UPDATE: Re-attach tracks when localStream changes
  useEffect(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];

      Object.values(peerConnections.current).forEach((pc) => {
        const senders = pc.getSenders();

        // Replace Video Track
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack);
        } else if (!videoSender && videoTrack) {
          pc.addTrack(videoTrack, localStream);
        }

        // Replace Audio Track
        const audioSender = senders.find(s => s.track?.kind === 'audio');
        if (audioSender && audioTrack) {
          audioSender.replaceTrack(audioTrack);
        } else if (!audioSender && audioTrack) {
          pc.addTrack(audioTrack, localStream);
        }
      });
    }
  }, [localStream]);

  // SCREEN SHARE TRACK UPDATE: Add/Remove screen share tracks when screenShareStream changes
  useEffect(() => {
    Object.entries(peerConnections.current).forEach(([socketId, pc]) => {
      // 1. Remove existing screen share tracks if they are no longer needed or changed
      const existingSenders = screenShareSendersRef.current[socketId] || [];
      existingSenders.forEach(sender => {
        try {
          pc.removeTrack(sender);
        } catch (err) {
          console.warn(`Error removing screen share track for ${socketId}:`, err);
        }
      });
      delete screenShareSendersRef.current[socketId];

      // 2. Add new screen share tracks if stream exists
      if (screenShareStream) {
        console.log(`Adding screen share tracks to PC ${socketId}`);
        const newSenders: RTCRtpSender[] = [];
        screenShareStream.getTracks().forEach(track => {
          const sender = pc.addTrack(track, screenShareStream);
          newSenders.push(sender);
        });
        screenShareSendersRef.current[socketId] = newSenders;
      }
    });

    // Cleanup logic: If we stopped sharing, ensure we also broadcast it
    if (!screenShareStream && isJoinedAsHost) {
      // Double check if we need to explicitly stop tracks elsewhere
    }
  }, [screenShareStream]);

  // RESYNC SCREEN SHARE STREAMS: Handle cases where track arrives before metadata (socket update)
  useEffect(() => {
    const { remoteStreams, addRemoteScreenStream, removeRemoteStream } = useMediaStore.getState();

    participants.forEach(p => {
      // @ts-ignore
      const socketId = p.socketId;
      if (p.isScreenSharing && p.screenShareStreamId && socketId) {
        // Find if this stream ID is currently in the regular camera bucket
        const cameraStream = remoteStreams[socketId];
        if (cameraStream && cameraStream.id === p.screenShareStreamId) {
          console.log(`Resyncing SCREEN SHARE for ${p.name}: moving stream from camera to screen bucket`);
          addRemoteScreenStream(socketId, cameraStream);
          removeRemoteStream(socketId);
        }
      }
    });
  }, [participants]);


  /* ---------------- CONNECTION MONITORING ---------------- */
  const checkConnection = useCallback(() => {
    if (!window.navigator.onLine) {
      setConnectionQuality('offline');
      return;
    }

    // @ts-ignore - Network Information API
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (conn) {
      const { effectiveType, downlink, rtt } = conn;
      if (effectiveType === '2g' || effectiveType === '3g' || downlink < 1 || rtt > 1000) {
        setConnectionQuality('poor');
      } else if (downlink > 5 && rtt < 200) {
        setConnectionQuality('excellent');
      } else {
        setConnectionQuality('good');
      }
    } else {
      // Fallback for browsers without Network Information API
      setConnectionQuality('good');
    }
  }, [setConnectionQuality]);

  useEffect(() => {
    const handleOnline = () => {
      checkConnection();
      import('sonner').then(({ toast }) => {
        toast.success('You are back online', {
          description: 'Connection restored successfully.',
          duration: 3000,
          position: 'top-center'
        });
      });
    };

    const handleOffline = () => {
      setConnectionQuality('offline');
      import('sonner').then(({ toast }) => {
        toast.error('You are offline', {
          description: 'Please check your internet connection.',
          duration: 5000,
          position: 'top-center'
        });
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkConnection();

    // @ts-ignore
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      conn.addEventListener('change', checkConnection);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn) conn.removeEventListener('change', checkConnection);

      // Cleanup Peer Connections
      Object.values(peerConnections.current).forEach((pc: RTCPeerConnection) => pc.close());
      clearRemoteStreams();
    };
  }, [checkConnection, setConnectionQuality, clearRemoteStreams]);

  // Toast for poor connection
  useEffect(() => {
    if (connectionQuality === 'poor') {
      import('sonner').then(({ toast }) => {
        toast.warning('Poor Connection Detected', {
          description: 'Your internet connection is unstable. Video quality may be reduced.',
          duration: 5000,
          id: 'poor-connection-toast', // prevent duplicates
          position: 'top-center'
        });
      });
    }
  }, [connectionQuality]);

  // Sync initial video restriction and waiting room from meeting settings
  useEffect(() => {
    if (meeting?.settings) {
      if (meeting.settings.disableParticipantVideo !== undefined) {
        setVideoRestriction(meeting.settings.disableParticipantVideo);
      }
      if (meeting.settings.enableWaitingRoom !== undefined) {
        useParticipantsStore.getState().setWaitingRoomEnabled(meeting.settings.enableWaitingRoom);
      }
    }
  }, [meeting?.settings, setVideoRestriction]);



  /* ---------------- CAMERA MANAGEMENT ---------------- */

  // Derived state for local participant
  const myParticipant = participants.find(p => p.id === user?.id)
    || participants.find(p => p.id === `participant-${user?.id}`)
    || participants[0]; // fallback for mock

  const isAudioMutedLocal = meetingStoreAudioMuted;
  const isVideoOffLocal = meetingStoreVideoOff;

  /* ---------------- SOCKET SYNC BRIDGE (LOCAL -> REMOTE) ---------------- */

  // Sync Media & Hand Raise
  useEffect(() => {
    if (meeting?.id && user && myParticipant) {
      emitParticipantUpdate(meeting.id, user.id, {
        isAudioMuted: meetingStoreAudioMuted,
        isVideoOff: meetingStoreVideoOff,
        isHandRaised: myParticipant.isHandRaised
      });
    }
  }, [meeting?.id, user?.id, meetingStoreAudioMuted, meetingStoreVideoOff, myParticipant?.isHandRaised]);

  // Sync Reactions
  const lastReactionIdForSync = useRef<string | null>(null);
  useEffect(() => {
    if (meeting?.id && reactions.length > 0) {
      const latest = reactions[reactions.length - 1];
      if (latest.id !== lastReactionIdForSync.current) {
        lastReactionIdForSync.current = latest.id;
        if (latest.participantId === user?.id) {
          emitReaction(meeting.id, latest);
        }
      }
    }
  }, [meeting?.id, reactions, user?.id]);

  // No longer needed to sync preview state to participant store on mount, 
  // because we now use MeetingStore as the authoritative source for local user.

  // Sync track enablement with store state for local participant (Store wins during meeting)
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => {
        if (t.enabled !== !isAudioMutedLocal) {
          t.enabled = !isAudioMutedLocal;
          console.log(`MeetingRoom: Audio track ${t.enabled ? 'enabled' : 'disabled'}`);
        }
      });
      localStream.getVideoTracks().forEach(t => {
        if (t.enabled !== !isVideoOffLocal) {
          t.enabled = !isVideoOffLocal;
          console.log(`MeetingRoom: Video track ${t.enabled ? 'enabled' : 'disabled'}`);
        }
      });
    }
  }, [isAudioMutedLocal, isVideoOffLocal, localStream]);

  /* ---------------- CAMERA MANAGEMENT (Initial & Recovery) ---------------- */
  const meetingJoined = useMeetingStore(state => state.meetingJoined);

  useEffect(() => {
    const initCamera = async () => {
      // Robust Guard 1: Do not initialize if we are not supposed to be joined or not hydrated
      if (!meetingJoined || !hasHydrated) {
        if (localStream && !meetingJoined) {
          localStream.getTracks().forEach(t => t.stop());
          setLocalStream(null);
          console.log("MeetingRoom: Meeting ended, force stopping tracks and clearing stream");
        }
        return;
      }

      // Use MeetingStore state (preview state) instead of ParticipantsStore
      // Only initialize if video is NOT explicitly off in the MeetingStore
      if (!meetingStoreVideoOff) {
        const needsStream =
          !localStream ||
          !localStream.active ||
          localStream.getVideoTracks().some(t => t.readyState === 'ended');

        if (needsStream) {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("MediaDevices API not supported.");
            return;
          }

          try {
            console.log("MeetingRoom: Initializing media stream...");
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                aspectRatio: { ideal: 16 / 9 },
                facingMode: 'user'
              },
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });

            // Set initial track states based on MeetingStore
            stream.getAudioTracks().forEach(t => t.enabled = !meetingStoreAudioMuted);
            stream.getVideoTracks().forEach(t => t.enabled = !meetingStoreVideoOff);

            console.log('MeetingRoom: Setting local stream', {
              hasAudio: stream.getAudioTracks().length > 0,
              hasVideo: stream.getVideoTracks().length > 0,
              audioEnabled: !meetingStoreAudioMuted,
              videoEnabled: !meetingStoreVideoOff
            });

            setLocalStream(stream);
          } catch (err) {
            console.error("Failed to access camera:", err);
          }
        }
      } else {
        // If video is off, ensure we stop any existing video tracks to turn off the LED
        if (localStream) {
          localStream.getVideoTracks().forEach(track => {
            track.stop();
            console.log("MeetingRoom: Stopped video track (video is off)");
          });
        }
      }
    };

    initCamera();
  }, [meetingStoreVideoOff, localStream, setLocalStream, meetingStoreAudioMuted, meetingJoined, hasHydrated]);

  // Cleanup on unmount - no longer stopping tracks here to allow persistence for floating preview
  useEffect(() => {
    return () => {
      // Logic for leaving is now centralized in useMeetingStore.leaveMeeting()
    };
  }, []);

  const [elapsedTime, setElapsedTime] = useState("00:00");
  const isHost = meeting?.hostId === user?.id;

  /* ---------------- AUTO-END LOGIC ---------------- */

  // 1. Listen for meeting_ended event (Server broadcast)
  const socket = useChatStore(state => state.socket);

  useEffect(() => {
    if (!socket) return;

    const onMeetingEnded = () => {
      console.log("Meeting ended by host/server. Leaving...");
      import('sonner').then(({ toast }) => {
        toast.info('Meeting Ended', {
          description: 'The meeting has been ended.',
          duration: 3000,
        });
      });
      useMeetingStore.getState().leaveMeeting();
      navigate('/');
    };

    const onMeetingExtended = (updatedMeeting: any) => {
      console.log("Meeting extended:", updatedMeeting);
      useMeetingStore.getState().setMeeting({
        ...useMeetingStore.getState().meeting!,
        ...updatedMeeting,
        endTime: updatedMeeting.endTime // Ensure this is synced
      });
      import('sonner').then(({ toast }) => {
        toast.success('Meeting Extended', {
          description: `New end time: ${new Date(updatedMeeting.endTime).toLocaleTimeString()}`,
          duration: 3000,
        });
      });
    };

    socket.on('meeting_ended', onMeetingEnded);
    socket.on('meeting_extended', onMeetingExtended);

    return () => {
      socket.off('meeting_ended', onMeetingEnded);
      socket.off('meeting_extended', onMeetingExtended);
    };
  }, [socket, navigate]);

  // 2. Timer Enforcement
  useEffect(() => {
    if (!meeting) return;
    if (!meeting.endTime && (!meeting.startTime || !meeting.duration)) return;

    const checkTime = () => {
      let endTime = 0;
      if (meeting.endTime) {
        endTime = Number(meeting.endTime);
      } else if (meeting.startTime && meeting.duration) {
        const start = new Date(meeting.startTime).getTime();
        endTime = start + (meeting.duration * 60 * 1000);
      } else {
        return;
      }

      const now = Date.now();
      if (now >= endTime) {
        if (isHost && now < endTime + 10000) {
          if (socket) {
            socket.emit('end_meeting', { meetingId: meeting.id });
          } else {
            useChatStore.getState().socket?.emit('end_meeting', { meetingId: meeting.id });
          }
        }
        if (now >= endTime + 5000) {
          console.log("Auto-end timer expired. Forcing leave.");
          useMeetingStore.getState().leaveMeeting();
          navigate('/');
        }
      }
    };

    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [meeting, isHost, navigate, socket]);

  /* ---------------- RECORDING TIMER ---------------- */

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && recordingStartTime) {
      interval = setInterval(() => {
        const diff = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(`${minutes}:${seconds}`);
      }, 1000);
    } else {
      setElapsedTime("00:00");
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  /* ---------------- ACTIVE SPEAKER (SIMULATION) ---------------- */

  useEffect(() => {
    const interval = setInterval(() => {
      const randomParticipant =
        participants[Math.floor(Math.random() * participants.length)];
      if (randomParticipant && !randomParticipant.isAudioMuted) {
        setActiveSpeaker(randomParticipant.id);
        setTimeout(() => setActiveSpeaker(null), 2000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [participants, setActiveSpeaker]);

  /* ---------------- WAITING ROOM LOGIC ---------------- */
  const isWaiting = useMeetingStore(state => state.isWaiting);

  if (isWaiting) {
    return (
      <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#232323] p-8 rounded-2xl max-w-md w-full text-center border border-[#404040] shadow-2xl"
        >
          <div className="w-16 h-16 bg-[#0B5CFF]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="w-8 h-8 text-[#0B5CFF] animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Waiting Room</h2>
          <p className="text-gray-400 mb-6">
            The host has been notified. Please wait while they admit you to the meeting.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              useMeetingStore.getState().leaveMeeting();
              navigate('/');
            }}
            className="w-full border-[#404040] hover:bg-[#2D2D2D] hover:text-white"
          >
            Leave Waiting Room
          </Button>
        </motion.div>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-screen bg-[#1C1C1C] pt-4">

      {/* MAIN CONTENT */}
      <div className="flex-1 min-h-0 relative">
        <MeetingControls />
        <VideoGrid />

        {/* Global Reactions Overlay */}
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
          <AnimatePresence>
            {reactions.map((reaction) => {
              const x = Math.random() * 80 + 10;
              return (
                <motion.div
                  key={reaction.id}
                  initial={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    left: `${x}%`,
                    bottom: 120
                  }}
                  animate={{
                    y: -320,
                    scale: 1.4,
                    opacity: 0
                  }}
                  transition={{
                    duration: 2.2,
                    ease: 'easeOut'
                  }}
                  onAnimationComplete={() => removeReaction(reaction.id)}
                  className="absolute text-5xl drop-shadow-lg"
                >
                  {reaction.emoji}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Connection Reconnecting Overlay */}
        <AnimatePresence>
          {(connectionQuality === 'poor' || connectionQuality === 'offline') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md"
            >
              <div className="bg-[#232323] border border-[#404040] rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center space-y-6">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                    <div className="relative bg-[#1C1C1C] p-4 rounded-full border border-[#404040]">
                      {connectionQuality === 'offline' ? (
                        <WifiOff className="w-8 h-8 text-red-500 animate-bounce" />
                      ) : (
                        <Wifi className="w-8 h-8 text-blue-400 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Connection unstable</h3>
                  <p className="text-gray-400 text-sm">
                    Reconnecting to the meeting... please wait.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={checkConnection}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reconnect
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatPanel />
      <ParticipantsPanel />
      <AICompanionPanel />
    </div>
  );
}
