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
    setVideoRestriction
  } = useParticipantsStore();

  const {
    meeting,
    reactions,
    removeReaction,
    isRecording,
    recordingStartTime,
    isVideoOff,
    localStream,
    setLocalStream
  } = useMeetingStore();

  // Sync initial video restriction from meeting settings
  useEffect(() => {
    if (meeting?.settings?.disableParticipantVideo !== undefined) {
      setVideoRestriction(meeting.settings.disableParticipantVideo);
    }
  }, [meeting?.settings?.disableParticipantVideo, setVideoRestriction]);

  /* ---------------- CAMERA MANAGEMENT ---------------- */

  const user = useAuthStore((state) => state.user);

  // Sync local media state to participant store for UI consistency
  useEffect(() => {
    const userId = user?.id; // Assuming user is available from useAuthStore
    if (!userId) return;

    const myParticipant = participants.find(p => p.id === userId)
      || participants.find(p => p.id === `participant-${userId}`);

    if (myParticipant) {
      // Only update if different to avoid loops
      if (myParticipant.isAudioMuted !== useMeetingStore.getState().isAudioMuted ||
        myParticipant.isVideoOff !== useMeetingStore.getState().isVideoOff) {

        // We need to import updateParticipant from the store hook if not already
        useParticipantsStore.getState().updateParticipant(myParticipant.id, {
          isAudioMuted: useMeetingStore.getState().isAudioMuted,
          isVideoOff: useMeetingStore.getState().isVideoOff
        });
      }
    }
  }, [useMeetingStore.getState().isAudioMuted, useMeetingStore.getState().isVideoOff, participants, user]);

  /* ---------------- CAMERA MANAGEMENT (Store handles tracks now) ---------------- */
  useEffect(() => {
    const initCamera = async () => {
      // Only initialize if video is NOT explicitly off
      if (!isVideoOff) {
        const needsStream =
          !localStream ||
          !localStream.active ||
          localStream.getVideoTracks().some(t => t.readyState === 'ended');

        if (needsStream) {
          // Check for API support first
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

            // Sync current state (mute/unmute) to new stream
            const { isAudioMuted } = useMeetingStore.getState();
            stream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);

            setLocalStream(stream);
          } catch (err) {
            console.error("Failed to access camera:", err);
          }
        }
      }
    };

    initCamera(); // Execute immediately
  }, [isVideoOff, localStream, setLocalStream]);

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
