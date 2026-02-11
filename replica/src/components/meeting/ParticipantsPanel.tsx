import { useState } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
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
    transientRoles,
    toggleHandRaise,
    updateParticipant,
    muteParticipant,     // MUST TOGGLE
    unmuteParticipant,
    muteAll,
    unmuteAll,
    makeHost,
    makeCoHost,
    revokeHost,
    revokeCoHost,
    removeParticipant,
    admitFromWaitingRoom,
    removeFromWaitingRoom,
    videoRestricted,
    setVideoRestriction,
    stopVideoAll,
    allowVideoAll,
    setVideoAllowed,
  } = useParticipantsStore();

  const [searchQuery, setSearchQuery] = useState('');

  const { user } = useAuthStore();
  const { meeting } = useMeetingStore();

  /** Resolve host status strictly by meeting.hostId */
  const isHost = meeting?.hostId === user?.id;

  /** Current participant from store */
  const currentUserParticipant = participants.find(p => p.id === user?.id);
  const currentRole = (currentUserParticipant && (transientRoles[currentUserParticipant.id] || currentUserParticipant.role)) || 'participant';

  const isCoHost = currentRole === 'co-host';
  const canControl = isHost || isCoHost; // general controls (mute all, waiting room)
  const canChangeRoles = isHost; // only host can change roles
  const isOriginalHost = meeting?.originalHostId === user?.id;
  const { setLocalStream, toggleAudio, toggleVideo } = useMeetingStore();

  const handleAudioToggle = async () => {
    const currentIsMuted = useMeetingStore.getState().isAudioMuted;
    const currentStream = useMeetingStore.getState().localStream;
    const hasEndedTrack = currentStream?.getAudioTracks().some(t => t.readyState === 'ended');

    if (currentIsMuted && (!currentStream || !currentStream.active || currentStream.getAudioTracks().length === 0 || hasEndedTrack)) {
      try {
        const isVideoOff = useMeetingStore.getState().isVideoOff;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: !isVideoOff
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to get audio stream:", err);
      }
    }
    toggleAudio();
    if (currentUserParticipant) {
      updateParticipant(currentUserParticipant.id, { isAudioMuted: !currentIsMuted });
    }
  };

  const handleVideoToggle = async () => {
    const currentIsVideoOff = useMeetingStore.getState().isVideoOff;
    const currentStream = useMeetingStore.getState().localStream;
    const hasEndedTrack = currentStream?.getVideoTracks().some(t => t.readyState === 'ended');

    if (currentIsVideoOff && (!currentStream || !currentStream.active || currentStream.getVideoTracks().length === 0 || hasEndedTrack)) {
      try {
        const isAudioMuted = useMeetingStore.getState().isAudioMuted;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: !isAudioMuted
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to get video stream:", err);
      }
    }
    toggleVideo();
    if (currentUserParticipant) {
      updateParticipant(currentUserParticipant.id, { isVideoOff: !currentIsVideoOff });
    }
  };

  /** SEARCH */
  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** 🔑 MUTE-ALL STATE (Only check manageable participants: regular and co-hosts) */
  const manageableParticipants = participants.filter(p => {
    const role = transientRoles[p.id] || p.role;
    return role === 'participant' || role === 'co-host';
  });
  const allMuted =
    manageableParticipants.length > 0 &&
    manageableParticipants.every(p => p.isAudioMuted === true);

  return (
    <AnimatePresence>
      {isParticipantsOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="
            fixed right-0 top-0 bottom-20
            w-full md:w-80 lg:w-96
            bg-[#1C1C1C]
            border-l border-[#404040]
            rounded-none
            z-30 flex flex-col min-h-0 overflow-hidden
            shadow-2xl
          "
        >
          {/* HEADER */}
          <div className="flex items-center justify-between p-4 border-b border-[#404040] flex-shrink-0">
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

          {/* SEARCH & HOST CONTROLS SIDE BY SIDE */}
          <div className="p-4 border-b border-[#404040] flex flex-col gap-3 md:flex-row md:items-center md:gap-2 flex-shrink-0">
            <div className="relative flex-[2.5] min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="pl-9 h-9 bg-[#232323] border-[#404040] text-sm"
              />
            </div>

            <div className="flex items-center gap-2 flex-none">
              {canControl && (
                <Button
                  onClick={() => {
                    if (allMuted) {
                      if (confirm('Unmute all participants?')) unmuteAll();
                    } else {
                      if (confirm('Mute all participants?')) muteAll();
                    }
                  }}
                  variant="ghost"
                  className="bg-[#2A2A2A] hover:bg-[#333] text-white border-none h-9 px-2 md:px-3 text-xs sm:text-sm"
                >
                  {allMuted ? (
                    <>
                      <Mic className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                      Unmute All
                    </>
                  ) : (
                    <>
                      <MicOff className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                      Mute All
                    </>
                  )}
                </Button>
              )}

              {isHost && (
                <Button
                  onClick={() => {
                    if (videoRestricted) {
                      if (confirm('Allow participants to start video?')) {
                        allowVideoAll();
                        setVideoRestriction(false);
                      }
                    } else {
                      if (confirm('Stop all participant videos and restrict them?')) {
                        stopVideoAll();
                        setVideoRestriction(true);
                      }
                    }
                  }}
                  variant="outline"
                  className="h-9 px-2 border-[#404040] hover:bg-[#2D2D2D] text-xs sm:text-sm"
                >
                  {videoRestricted ? (
                    <>
                      <Video className="w-3.5 h-3.5 mr-1 text-green-500" />
                      Enable All
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-3.5 h-3.5 mr-1 text-red-500" />
                      Disable All
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* MAIN SCROLLABLE CONTENT: waiting room + participants list scroll together */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4">
            {/* WAITING ROOM - Only visible to host and co-hosts */}
            {waitingRoom.length > 0 && canControl && (
              <div className="border-b border-[#404040]">
                <div className="p-4 bg-[#232323]">
                  <h4 className="text-sm font-semibold mb-3">
                    Waiting Room ({waitingRoom.length})
                  </h4>
                  <div className="space-y-2 pr-1 custom-scrollbar">
                    {waitingRoom.map(person => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm">{person.name}</span>
                        <div className="flex gap-4 items-center">
                          <Button
                            size="sm"
                            onClick={() => admitFromWaitingRoom(person.id)}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold h-8 px-4"
                          >
                            Admit
                          </Button>
                          <button
                            onClick={() => removeFromWaitingRoom(person.id)}
                            className="text-white hover:text-gray-300 text-sm font-medium transition-colors"
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PARTICIPANTS LIST */}
            {filteredParticipants.map(participant => {
              const displayedRole = transientRoles[participant.id] || participant.role;
              const coHostCount = participants.filter(p => (transientRoles[p.id] || p.role) === 'co-host').length;
              const hostCount = participants.filter(p => (transientRoles[p.id] || p.role) === 'host').length;

              const isCurrentUser =
                participant.id === user?.id ||
                participant.id === `participant-${user?.id}` ||
                (user?.role === 'host' && participant.id === 'participant-1');

              return (
                <ParticipantItem
                  key={participant.id}
                  participant={participant}
                  isCurrentUser={isCurrentUser}
                  canControl={canControl}
                  canChangeRoles={canChangeRoles}
                  isOriginalHost={isOriginalHost}
                  onToggleHand={() => toggleHandRaise(participant.id)}
                  onToggleMute={participant.id === user?.id ? handleAudioToggle : () => {
                    if (participant.isAudioMuted) {
                      unmuteParticipant(participant.id);
                    } else {
                      muteParticipant(participant.id);
                    }
                  }}
                  onMakeHost={() => makeHost(participant.id)}
                  onMakeCoHost={() => makeCoHost(participant.id)}
                  onRemove={() => removeParticipant(participant.id)}
                  onRevokeHost={() => revokeHost(participant.id)}
                  onRevokeCoHost={() => revokeCoHost(participant.id)}
                  onToggleVideoAllowed={() => setVideoAllowed(participant.id, !(participant.isVideoAllowed !== false))}
                  onToggleVideo={participant.id === user?.id ? handleVideoToggle : undefined}
                  displayedRole={displayedRole}
                  coHostCount={coHostCount}
                  hostCount={hostCount}
                />
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- PARTICIPANT ITEM ---------------- */

interface ParticipantItemProps {
  participant: Participant;
  isCurrentUser: boolean;
  canControl: boolean;
  canChangeRoles?: boolean;
  isOriginalHost?: boolean;
  onToggleHand: () => void;
  onToggleMute: () => void;
  onMakeHost: () => void;
  onMakeCoHost: () => void;
  onRemove: () => void;
  onRevokeHost: () => void;
  onRevokeCoHost: () => void;
  onToggleVideoAllowed: () => void;
  onToggleVideo?: () => void;
  displayedRole?: Participant['role'];
  coHostCount: number;
  hostCount: number;
}

function ParticipantItem({
  participant,
  isCurrentUser,
  canControl,
  canChangeRoles = false,
  onToggleHand,
  onToggleMute,
  onMakeHost,
  onMakeCoHost,
  onRemove,
  onRevokeHost,
  onRevokeCoHost,
  onToggleVideoAllowed,
  onToggleVideo,
  isOriginalHost = false,
  displayedRole = participant.role,
  coHostCount,
  hostCount,
}: ParticipantItemProps) {
  const effectiveRole = displayedRole || participant.role;

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
            {effectiveRole === 'host' && (
              <Crown className="w-4 h-4 text-yellow-500" />
            )}
            {effectiveRole === 'co-host' && (
              <Shield className="w-4 h-4 text-purple-500" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={isCurrentUser ? onToggleMute : undefined}
              className={cn(
                "transition-opacity hover:opacity-80",
                !isCurrentUser && "cursor-default"
              )}
            >
              {participant.isAudioMuted ? (
                <MicOff className="w-3 h-3 text-red-500" />
              ) : (
                <Mic className="w-3 h-3 text-green-500" />
              )}
            </button>
            <button
              onClick={isCurrentUser ? onToggleVideo : undefined}
              className={cn(
                "transition-opacity hover:opacity-80",
                !isCurrentUser && "cursor-default"
              )}
            >
              {participant.isVideoOff ? (
                <VideoOff className="w-3 h-3 text-red-500" />
              ) : (
                <Video className="w-3 h-3 text-green-500" />
              )}
            </button>
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
              {/* Manageable roles: participants and co-hosts (only if manageable by current user) */}
              {(effectiveRole === 'participant' || (effectiveRole === 'co-host' && canChangeRoles)) && (
                <DropdownMenuItem onClick={onToggleMute}>
                  <MicOff className="w-4 h-4 mr-2" />
                  {participant.isAudioMuted ? 'Unmute' : 'Mute'}
                </DropdownMenuItem>
              )}

              {/* Video Permission Control (Host can manage both, Co-host can only manage participants if allowed) */}
              {canControl && (effectiveRole === 'participant' || (effectiveRole === 'co-host' && canChangeRoles)) && (
                <DropdownMenuItem onClick={onToggleVideoAllowed}>
                  {participant.isVideoAllowed === false ? (
                    <>
                      <Video className="w-4 h-4 mr-2 text-green-500" />
                      Allow Video
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-4 h-4 mr-2 text-red-500" />
                      Stop Video
                    </>
                  )}
                </DropdownMenuItem>
              )}

              {canChangeRoles && (
                <>
                  {effectiveRole !== 'host' && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (hostCount >= 2) {
                          alert('Cannot add host: Maximum 1 additional host allowed.');
                          return;
                        }
                        onMakeHost();
                      }}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Make Host
                    </DropdownMenuItem>
                  )}

                  {effectiveRole === 'host' && (
                    <DropdownMenuItem onClick={onRevokeHost} className="text-yellow-400">
                      <Crown className="w-4 h-4 mr-2" />
                      Remove Host
                    </DropdownMenuItem>
                  )}

                  {effectiveRole !== 'co-host' && effectiveRole !== 'host' && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (coHostCount >= 2) {
                          alert('Cannot add co-host: Maximum 2 co-hosts allowed.');
                          return;
                        }
                        onMakeCoHost();
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Make Co-Host
                    </DropdownMenuItem>
                  )}

                  {effectiveRole === 'co-host' && (
                    <DropdownMenuItem
                      onClick={onRevokeCoHost}
                      className="text-yellow-400"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Remove Co-Host
                    </DropdownMenuItem>
                  )}
                </>
              )}

              <DropdownMenuItem
                onClick={() => {
                  // Prevent removing the host via UI; store also protects this partially, but logically we shouldn't remove a host unless we revoke first?
                  // "remove the newly assigned Host" -> This is "Remove Host" role, or "Remove Participant" entirely?
                  // User request says "should still be able to remove the newly assigned Host". This could mean KICK them.
                  // If they are a host, we probably shouldn't kick them without revoking host first? Or can we?
                  // Let's assume KICK is allowed if distinct from Revoke Role. 
                  // But usually you can't kick a Host.
                  // I will leave the existing check blocking kick of host.
                  if (effectiveRole === 'host') {
                    alert('Cannot remove a participant with Host role. Revoke Host role first.');
                    return;
                  }
                  onRemove();
                }}
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
