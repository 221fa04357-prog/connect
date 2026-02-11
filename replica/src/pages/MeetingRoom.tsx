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
    participants,
    setActiveSpeaker,
    waitingRoom,
    admitFromWaitingRoom,
    removeFromWaitingRoom
  } = useParticipantsStore();

  const user = useAuthStore((state) => state.user);

  const {
    reactions,
    removeReaction,
    isRecording,
    recordingStartTime,
    isVideoOff,
    localStream,
    setLocalStream
  } = useMeetingStore();

  /* ---------------- CAMERA MANAGEMENT ---------------- */
  useEffect(() => {
    const initCamera = async () => {
      // Only initialize if video is NOT explicitly off and we don't have an active stream
      if (!isVideoOff) {
        const needsStream = !localStream || !localStream.active || localStream.getVideoTracks().some(t => t.readyState === 'ended');

        if (needsStream) {
          try {
            console.log("MeetingRoom: Initializing media stream...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            // Sync current state to new tracks
            const { isAudioMuted, isVideoOff: videoOffState } = useMeetingStore.getState();
            stream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
            stream.getVideoTracks().forEach(t => t.enabled = !videoOffState);

            setLocalStream(stream);
          } catch (err) {
            console.error("MeetingRoom: Failed to access camera:", err);
          }
        }
      }
    };

  /* ---------------- CAMERA MANAGEMENT (Store handles tracks now) ---------------- */
  // Just ensure stream is active if video is supposed to be ON
  useEffect(() => {
    if (!isVideoOff && (!localStream || !localStream.active)) {
      // Re-acquire if missing
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            // Apply current state
            const { isAudioMuted } = useMeetingStore.getState();
            stream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
            // Video is enabled by default in new stream
            setLocalStream(stream);
          })
          .catch(e => console.error("Re-acquire camera failed", e));
      } else {
        console.error("MediaDevices API not supported.");
      }
    }
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
  const isHost = user?.role === 'host';
  const [showHostWaitingOverlay, setShowHostWaitingOverlay] = useState(false);

  /* ---------------- WAITING ROOM LOGIC ---------------- */
  useEffect(() => {
    if (isHost && waitingRoom.length > 0) {
      setShowHostWaitingOverlay(true);
    } else {
      setShowHostWaitingOverlay(false);
    }
  }, [isHost, waitingRoom.length]);

  useEffect(() => {
    if (user && waitingRoom.some(w => w.name === user.name)) {
      setWaiting(true);
    } else {
      setWaiting(false);
    }
  }, [user, waitingRoom]);

  /* ---------------- RECORDING TIMER ---------------- */
  useEffect(() => {
    let interval: any;
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
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, recordingStartTime]);

  /* ---------------- ACTIVE SPEAKER ---------------- */
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

  /* ---------------- HOST WAITING OVERLAY ---------------- */
  const HostWaitingRoomOverlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl px-8 py-8 w-full max-w-2xl">
        <h3 className="text-xl text-white mb-4">
          Waiting Room ({waitingRoom.length})
        </h3>
        {waitingRoom.map(person => (
          <div key={person.id} className="flex justify-between mb-3">
            <span className="text-white">{person.name}</span>
            <div className="flex gap-2">
              <button
                className="bg-green-500 px-3 py-1 rounded"
                onClick={() => admitFromWaitingRoom(person.id)}
              >
                Admit
              </button>
              <button
                className="bg-red-500 px-3 py-1 rounded"
                onClick={() => removeFromWaitingRoom(person.id)}
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1C] pt-4">
      {showHostWaitingOverlay && <HostWaitingRoomOverlay />}

      <div className="flex-1 min-h-0 relative">
        <TopBar />
        <VideoGrid />

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
