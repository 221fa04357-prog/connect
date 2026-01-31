import { useEffect, useState } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import VideoGrid from '@/components/meeting/VideoGrid';
import ControlBar from '@/components/meeting/ControlBar';
import ChatPanel from '@/components/meeting/ChatPanel';
import ParticipantsPanel from '@/components/meeting/ParticipantsPanel';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

export default function MeetingRoom() {
  const { participants, setActiveSpeaker, waitingRoom, admitFromWaitingRoom, removeFromWaitingRoom } = useParticipantsStore();
  const { reactions, isRecording, recordingStartTime } = useMeetingStore();
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const user = useAuthStore((state) => state.user);
  const [waiting, setWaiting] = useState(false);
  const isHost = user?.role === 'host';
  const [showHostWaitingOverlay, setShowHostWaitingOverlay] = useState(false);

  useEffect(() => {
    if (isHost && waitingRoom.length > 0) {
      setShowHostWaitingOverlay(true);
    } else {
      setShowHostWaitingOverlay(false);
    }
  }, [isHost, waitingRoom.length]);

  // Check if current user is in waiting room
  useEffect(() => {
    if (user && waitingRoom.some(w => w.name === user.name)) {
      setWaiting(true);
    } else {
      setWaiting(false);
    }
  }, [user, waitingRoom]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && recordingStartTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((now - recordingStartTime) / 1000);
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(`${minutes}:${seconds}`);
      }, 1000);
    } else {
      setElapsedTime("00:00");
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  // Simulate active speaker detection
  useEffect(() => {
    const interval = setInterval(() => {
      const randomParticipant = participants[Math.floor(Math.random() * participants.length)];
      if (randomParticipant && !randomParticipant.isAudioMuted) {
        setActiveSpeaker(randomParticipant.id);

        // Clear after 2 seconds
        setTimeout(() => setActiveSpeaker(null), 2000);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [participants, setActiveSpeaker]);

  if (waiting) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#1C1C1C]">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-lg px-8 py-10 flex flex-col items-center">
          <span className="text-3xl font-bold text-white mb-2">Waiting Room</span>
          <span className="text-lg text-gray-200 mb-6">Please wait, the host will let you in soon.</span>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <button
            className="mt-2 text-sm text-blue-400 hover:underline"
            onClick={() => setWaiting(false)}
          >
            Leave Waiting Room
          </button>
        </div>
      </div>
    );
  }

  // Host waiting room overlay/modal
  const HostWaitingRoomOverlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl px-8 py-8 w-full max-w-2xl mx-4 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <span className="text-2xl font-bold text-white">Waiting Room ({waitingRoom.length})</span>
          <button
            className="text-white text-xl hover:text-blue-400"
            onClick={() => setShowHostWaitingOverlay(false)}
            title="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto max-h-96 space-y-4 pr-2">
          {waitingRoom.map(person => (
            <div key={person.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
              <span className="text-base text-white font-medium">{person.name}</span>
              <div className="flex gap-2">
                <button
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded-md font-semibold"
                  onClick={() => admitFromWaitingRoom(person.id)}
                >
                  Admit
                </button>
                <button
                  className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-1 rounded-md font-semibold"
                  onClick={() => removeFromWaitingRoom(person.id)}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1C] pt-4">
      {/* Host Waiting Room Overlay */}
      {showHostWaitingOverlay && <HostWaitingRoomOverlay />}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        <VideoGrid />

        {/* Reactions Overlay */}
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: 1, y: -150, scale: 1.5, x: Math.random() * 40 - 20 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute text-5xl pointer-events-none z-50 filter drop-shadow-lg"
              style={{
                left: `${Math.random() * 60 + 20}%`,
                bottom: '15%'
              }}
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Control Bar */}
      <ControlBar />

      {/* Side Panels */}
      <ChatPanel />
      <ParticipantsPanel />
    </div>
  );
}