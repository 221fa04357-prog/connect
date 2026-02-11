import { useEffect, useState } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import VideoGrid from '@/components/meeting/VideoGrid';
import ControlBar from '@/components/meeting/ControlBar';
import TopBar from '@/components/meeting/TopBar';
import ChatPanel from '@/components/meeting/ChatPanel';
import ParticipantsPanel from '@/components/meeting/ParticipantsPanel';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/useAuthStore';

export default function MeetingRoom() {
  const {
    participants, // Active participants list
    setActiveSpeaker,
    waitingRoom,
    admitFromWaitingRoom,
    removeFromWaitingRoom,
    setVideoRestriction,
    updateParticipant
  } = useParticipantsStore();

  const {
    meeting,
    reactions,
    removeReaction,
    isRecording,
    recordingStartTime,
    localStream,
    setLocalStream,
    isAudioMuted: meetingStoreAudioMuted,
    isVideoOff: meetingStoreVideoOff
  } = useMeetingStore();

  // Sync initial video restriction from meeting settings
  useEffect(() => {
    if (meeting?.settings?.disableParticipantVideo !== undefined) {
      setVideoRestriction(meeting.settings.disableParticipantVideo);
    }
  }, [meeting?.settings?.disableParticipantVideo, setVideoRestriction]);

  /* ---------------- CAMERA MANAGEMENT ---------------- */

  const user = useAuthStore((state) => state.user);

  // Derived state for local participant
  const myParticipant = participants.find(p => p.id === user?.id)
    || participants.find(p => p.id === `participant-${user?.id}`)
    || participants[0]; // fallback for mock

  const isAudioMutedLocal = myParticipant?.isAudioMuted ?? true;
  const isVideoOffLocal = myParticipant?.isVideoOff ?? true;

  // Preserve preview states: One-time sync from MeetingStore to ParticipantsStore on mount
  useEffect(() => {
    if (myParticipant) {
      // Sync from MeetingStore (which holds the preview state) to ParticipantsStore
      if (myParticipant.isAudioMuted !== meetingStoreAudioMuted || myParticipant.isVideoOff !== meetingStoreVideoOff) {
        console.log("MeetingRoom: Syncing preview state from MeetingStore to participant store...");
        updateParticipant(myParticipant.id, {
          isAudioMuted: meetingStoreAudioMuted,
          isVideoOff: meetingStoreVideoOff
        });
      }
    }
  }, [myParticipant?.id]); // Run once when participant is ready

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
  useEffect(() => {
    const initCamera = async () => {
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
              video: true,
              audio: true
            });

            // Set initial track states based on MeetingStore
            stream.getAudioTracks().forEach(t => t.enabled = !meetingStoreAudioMuted);
            stream.getVideoTracks().forEach(t => t.enabled = !meetingStoreVideoOff);

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
  }, [meetingStoreVideoOff, localStream, setLocalStream, meetingStoreAudioMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const stream = useMeetingStore.getState().localStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        useMeetingStore.getState().setLocalStream(null);
      }
    };
  }, []);

  const [elapsedTime, setElapsedTime] = useState("00:00");
  const [waiting, setWaiting] = useState(false);
  const isHost = meeting?.hostId === user?.id;

  /* ---------------- WAITING ROOM LOGIC ---------------- */

  useEffect(() => {
    if (user && waitingRoom.some(w => w.name === user.name)) {
      setWaiting(true);
    } else {
      setWaiting(false);
    }
  }, [user, waitingRoom]);

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

  if (waiting) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#1C1C1C]">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-8 py-10">
          <h2 className="text-2xl text-white mb-4">Waiting Room</h2>
          <p className="text-gray-300">Host will let you in soon…</p>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-screen bg-[#1C1C1C] pt-4">

      {/* MAIN CONTENT */}
      <div className="flex-1 min-h-0 relative">
        <TopBar />
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
      </div>

      <ControlBar />
      <ChatPanel />
      <ParticipantsPanel />
    </div>
  );
}
