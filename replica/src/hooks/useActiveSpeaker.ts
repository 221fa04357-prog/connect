import { useEffect } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';

// Simulates active speaker detection
export const useActiveSpeaker = () => {
  const { participants, setActiveSpeaker } = useParticipantsStore();

  useEffect(() => {
    // Simulate active speaker changes every 3-5 seconds
    const interval = setInterval(() => {
      const unmutedParticipants = participants.filter((p) => !p.isAudioMuted);
      
      if (unmutedParticipants.length > 0) {
        const randomSpeaker = unmutedParticipants[
          Math.floor(Math.random() * unmutedParticipants.length)
        ];
        setActiveSpeaker(randomSpeaker.id);
      } else {
        setActiveSpeaker(null);
      }
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [participants, setActiveSpeaker]);
};