import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import VideoTile from './VideoTile';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

export default function VideoGrid() {
  const { participants, activeSpeakerId, pinnedParticipantId, pinParticipant, unpinParticipant, focusedParticipantId, setFocusedParticipant } = useParticipantsStore();
  // ESC key handler for exiting fullscreen
  useEffect(() => {
    if (!focusedParticipantId) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusedParticipant(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [focusedParticipantId]);
  const { viewMode, showSelfView } = useMeetingStore();
  const { user } = useAuthStore();

  const handlePin = (participantId: string) => {
    if (pinnedParticipantId === participantId) {
      unpinParticipant();
    } else {
      pinParticipant(participantId);
    }
  };

  // Filter participants based on Self View setting
  const visibleParticipants = participants.filter(p => {
    const isLocal =
      p.id === user?.id ||
      p.id === `participant-${user?.id}` ||
      (user?.role === 'host' && p.id === 'participant-1');
    if (isLocal) {
      return showSelfView;
    }
    return true;
  });

  // Fullscreen logic
  if (focusedParticipantId) {
    const participant = participants.find(p => p.id === focusedParticipantId);
    if (!participant) return null;
    return (
      <div className="relative h-dvh overflow-hidden">
        <div className="h-full pt-[30px] pb-[105px] flex items-center justify-center">
          <div className="w-full h-full bg-black rounded-xl overflow-hidden">
            <VideoTile
              participant={participant}
              isActive={participant.id === activeSpeakerId}
              isPinned={pinnedParticipantId === participant.id}
              onPin={() => handlePin(participant.id)}
              onClick={() => setFocusedParticipant(null)}
              fullscreen
              onExitFullscreen={() => setFocusedParticipant(null)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Responsive Zoom-like Gallery View
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-[110px] no-scrollbar">
      <div
        className={cn(
          'grid gap-2 md:gap-4 p-2 md:p-4 w-full',
        )}
        style={{
          gridTemplateColumns: window.innerWidth >= 768
            ? 'repeat(auto-fit, minmax(200px, 1fr))'
            : 'repeat(auto-fit, minmax(140px, 1fr))',
          gridAutoRows: '1fr',
          alignItems: 'stretch',
          justifyItems: 'stretch',
        }}
      >
        {visibleParticipants.map((participant) => (
          <VideoTile
            key={participant.id}
            participant={participant}
            isActive={participant.id === activeSpeakerId}
            isPinned={pinnedParticipantId === participant.id}
            onPin={() => handlePin(participant.id)}
            onClick={() => setFocusedParticipant(participant.id)}
          />
        ))}
      </div>
    </div>
  );
}
