import { useEffect, useState } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import VideoGrid from '@/components/meeting/VideoGrid';
import ControlBar from '@/components/meeting/ControlBar';
import ChatPanel from '@/components/meeting/ChatPanel';
import ParticipantsPanel from '@/components/meeting/ParticipantsPanel';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio } from 'lucide-react';

export default function MeetingRoom() {
  const { participants, setActiveSpeaker } = useParticipantsStore();
  const { reactions, isRecording, recordingStartTime } = useMeetingStore();
  const [elapsedTime, setElapsedTime] = useState("00:00");

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

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1C] pt-4">
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