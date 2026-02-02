import { useEffect, useState } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import VideoGrid from '@/components/meeting/VideoGrid';
import ControlBar from '@/components/meeting/ControlBar';
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

  const {
    reactions,
    removeReaction,   // 🔥 IMPORTANT
    isRecording,
    recordingStartTime
  } = useMeetingStore();

  const [elapsedTime, setElapsedTime] = useState("00:00");
  const user = useAuthStore((state) => state.user);
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

      {/* ---------------- MAIN CONTENT ---------------- */}
      <div className="flex-1 min-h-0 relative">
        <VideoGrid />

        {/* 🔥 ZOOM-STYLE GLOBAL REACTIONS OVERLAY */}
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
          <AnimatePresence>
            {reactions.map((reaction) => {
              const x = Math.random() * 80 + 10; // generate ONCE

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
                    y: -320,          // FAST UP
                    scale: 1.4,
                    opacity: 0
                  }}
                  transition={{
                    duration: 2.2,    // QUICK DISAPPEAR
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

      {/* ---------------- CONTROL BAR ---------------- */}
      <ControlBar />

      {/* ---------------- SIDE PANELS ---------------- */}
      <ChatPanel />
      <ParticipantsPanel />
    </div>
  );
}
