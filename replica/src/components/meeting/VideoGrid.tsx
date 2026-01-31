import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import VideoTile from './VideoTile';
import { cn } from '@/lib/utils';

export default function VideoGrid() {
  const { participants, activeSpeakerId, pinnedParticipantId, pinParticipant, unpinParticipant } = useParticipantsStore();
  const { viewMode } = useMeetingStore();

  const handlePin = (participantId: string) => {
    if (pinnedParticipantId === participantId) {
      unpinParticipant();
    } else {
      pinParticipant(participantId);
    }
  };

  if (viewMode === 'speaker') {
    const speaker = participants.find(p => p.id === activeSpeakerId) || participants[0];
    const others = participants.filter(p => p.id !== speaker.id);

    return (
      <div className="h-full flex flex-col gap-2 p-4">
        {/* Main Speaker */}
        <div className="flex-1">
          <VideoTile
            participant={speaker}
            isActive={true}
            isPinned={pinnedParticipantId === speaker.id}
            onPin={() => handlePin(speaker.id)}
            className="h-full"
          />
        </div>

        {/* Thumbnails */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {others.map((participant) => (
            <VideoTile
              key={participant.id}
              participant={participant}
              isActive={participant.id === activeSpeakerId}
              isPinned={pinnedParticipantId === participant.id}
              onPin={() => handlePin(participant.id)}
              className="w-32 flex-shrink-0"
            />
          ))}
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
        {participants.map((participant) => (
          <VideoTile
            key={participant.id}
            participant={participant}
            isActive={participant.id === activeSpeakerId}
            isPinned={pinnedParticipantId === participant.id}
            onPin={() => handlePin(participant.id)}
          />
        ))}
      </div>
    </div>
  );
}