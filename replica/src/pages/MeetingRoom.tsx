import { useEffect } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import VideoGrid from '@/components/meeting/VideoGrid';
import ControlBar from '@/components/meeting/ControlBar';
import ChatPanel from '@/components/meeting/ChatPanel';
import ParticipantsPanel from '@/components/meeting/ParticipantsPanel';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function MeetingRoom() {
  const { participants, setActiveSpeaker } = useParticipantsStore();
  const { reactions } = useMeetingStore();

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

  return (
    <div className="h-screen bg-[#1C1C1C] flex flex-col overflow-hidden pt-4">
      {/* Main Content Area */}
      <div className="flex-1 relative">
        <VideoGrid />

        {/* Reactions Overlay */}
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: 0, scale: 1 }}
              animate={{ opacity: 1, y: -100, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2 }}
              className="absolute text-4xl pointer-events-none"
              style={{
                left: `${Math.random() * 80 + 10}%`,
                bottom: '20%'
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