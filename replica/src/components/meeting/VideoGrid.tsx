import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import VideoTile from './VideoTile';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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

  // Gallery View
  const gridCols = participants.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
    participants.length <= 4 ? 'grid-cols-2' :
      participants.length <= 9 ? 'grid-cols-2 md:grid-cols-3' :
        'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className={cn('grid gap-2 md:gap-4 p-2 md:p-4 h-full overflow-auto', gridCols)}>
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
  );
}