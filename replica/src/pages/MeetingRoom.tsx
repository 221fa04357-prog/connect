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
    <div className="h-screen bg-[#1C1C1C] flex flex-col overflow-hidden pt-4">

      {/* Recording Indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-[#232323]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-red-500/30"
          >
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </div>
            <span className="text-white font-mono text-sm font-medium tracking-wider">REC {elapsedTime}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col min-h-0">
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