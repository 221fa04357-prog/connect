import { useState } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  MoreVertical,
  Crown,
  Shield,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Participant } from '@/types';

export default function ParticipantsPanel() {
  const { isParticipantsOpen, toggleParticipants } = useMeetingStore();

  const {
    participants,
    waitingRoom,
    toggleHandRaise,
    muteParticipant,     // MUST TOGGLE
    unmuteParticipant,
    muteAll,
    unmuteAll,
    makeHost,
    makeCoHost,
    removeParticipant,
    admitFromWaitingRoom,
    removeFromWaitingRoom,
  } = useParticipantsStore();

  const [searchQuery, setSearchQuery] = useState('');

  /** CURRENT USER */
  const currentUser = participants.find(p => p.id === 'participant-1');
  const isHost = currentUser?.role === 'host';
  const isCoHost = currentUser?.role === 'co-host';
  const canControl = isHost || isCoHost;

  /** SEARCH */
  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** 🔑 MUTE-ALL STATE */
  const allMuted =
    participants.length > 0 &&
    participants.every(p => p.isAudioMuted === true);

  return (
    <AnimatePresence>
      {isParticipantsOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="
            fixed right-0 top-0 bottom-0
            w-full md:w-80 lg:w-96
            bg-[#1C1C1C]
            border-l border-[#404040]
            z-30 flex flex-col
          "
        >
          {/* HEADER */}
          <div className="flex items-center justify-between p-4 border-b border-[#404040]">
            <h3 className="text-lg font-semibold">
              Participants ({participants.length})
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleParticipants}
              className="hover:bg-[#2D2D2D]"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* SEARCH */}
          <div className="p-4 border-b border-[#404040]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search participants..."
                className="pl-10 bg-[#232323] border-[#404040]"
              />
            </div>
          </div>

          {/* 🔇 HOST CONTROLS */}
          {canControl && (
            <div className="p-4 border-b border-[#404040]">
              <Button
                onClick={() => {
                  if (allMuted) {
                    if (confirm('Unmute all participants?')) unmuteAll();
                  } else {
                    if (confirm('Mute all participants?')) muteAll();
                  }
                }}
                variant="outline"
                className="w-full justify-start border-[#404040] hover:bg-[#2D2D2D]"
              >
                {allMuted ? (
                  <>
                    <Mic className="w-4 h-4 mr-2 text-green-500" />
                    Unmute All
                  </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4 mr-2 text-red-500" />
                    Mute All
                  </>
                )}
              </Button>
            </div>
          )}

          {/* WAITING ROOM */}
          {waitingRoom.length > 0 && canControl && (
            <div className="border-b border-[#404040]">
              <div className="p-4 bg-[#232323]">
                <h4 className="text-sm font-semibold mb-3">
                  Waiting Room ({waitingRoom.length})
                </h4>
                <div className="space-y-2">
                  {waitingRoom.map(person => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{person.name}</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => admitFromWaitingRoom(person.id)}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          Admit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromWaitingRoom(person.id)}
                          className="hover:bg-red-500/20"
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PARTICIPANTS LIST */}
          <div className="flex-1 overflow-y-auto">
            {filteredParticipants.map(participant => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                canControl={canControl}
                onToggleHand={() => toggleHandRaise(participant.id)}
                onToggleMute={() => {
                  if (participant.isAudioMuted) {
                    unmuteParticipant(participant.id);
                  } else {
                    muteParticipant(participant.id);
                  }
                }}
                onMakeHost={() => makeHost(participant.id)}
                onMakeCoHost={() => makeCoHost(participant.id)}
                onRemove={() => removeParticipant(participant.id)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- PARTICIPANT ITEM ---------------- */

interface ParticipantItemProps {
  participant: Participant;
  canControl: boolean;
  onToggleHand: () => void;
  onToggleMute: () => void;
  onMakeHost: () => void;
  onMakeCoHost: () => void;
  onRemove: () => void;
}

function ParticipantItem({
  participant,
  canControl,
  onToggleHand,
  onToggleMute,
  onMakeHost,
  onMakeCoHost,
  onRemove,
}: ParticipantItemProps) {
  const isCurrentUser = participant.id === 'participant-1';

  return (
    <div className="flex items-center justify-between p-4 hover:bg-[#232323]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
          style={{ backgroundColor: participant.avatar }}
        >
          {participant.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {participant.name} {isCurrentUser && '(You)'}
            </span>
            {participant.role === 'host' && (
              <Crown className="w-4 h-4 text-yellow-500" />
            )}
            {participant.role === 'co-host' && (
              <Shield className="w-4 h-4 text-purple-500" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            {participant.isAudioMuted ? (
              <MicOff className="w-3 h-3 text-red-500" />
            ) : (
              <Mic className="w-3 h-3 text-green-500" />
            )}
            {participant.isVideoOff ? (
              <VideoOff className="w-3 h-3 text-red-500" />
            ) : (
              <Video className="w-3 h-3 text-green-500" />
            )}
            {participant.isHandRaised && (
              <Hand className="w-3 h-3 text-yellow-500" />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isCurrentUser && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleHand}
            className={cn(
              'hover:bg-[#2D2D2D]',
              participant.isHandRaised && 'text-yellow-500'
            )}
          >
            <Hand className="w-4 h-4" />
          </Button>
        )}

        {canControl && !isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="hover:bg-[#2D2D2D]">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#232323] border-[#404040]"
            >
              <DropdownMenuItem onClick={onToggleMute}>
                <MicOff className="w-4 h-4 mr-2" />
                {participant.isAudioMuted ? 'Unmute' : 'Mute'}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={onMakeHost}>
                <Crown className="w-4 h-4 mr-2" />
                Make Host
              </DropdownMenuItem>

              <DropdownMenuItem onClick={onMakeCoHost}>
                <Shield className="w-4 h-4 mr-2" />
                Make Co-Host
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={onRemove}
                className="text-red-500"
              >
                <X className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
