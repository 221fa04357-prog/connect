import { useMeetingStore } from '@/stores/useMeetingStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  Users, MoreVertical, Grid3x3,
  User, Settings, ChevronUp, Share2, Shield, Circle, Smile
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reaction } from '@/types';
import { useNavigate } from 'react-router-dom';

const reactionEmojis = ['👍', '👏', '❤️', '😂', '😮', '🎉'];

export default function ControlBar() {
  const navigate = useNavigate();
  // Store hooks
  const { user } = useAuthStore();
  const {
    meeting,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    isRecording,
    isChatOpen,
    isParticipantsOpen,
    viewMode,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleRecording,
    toggleChat,
    toggleParticipants,
    toggleSettings,
    setViewMode,
    addReaction,
    leaveMeeting
  } = useMeetingStore();

  const { participants, updateParticipant } = useParticipantsStore();

  // Local state
  const [showReactions, setShowReactions] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showScreenShareOptions, setShowScreenShareOptions] = useState(false);

  // Derived state
  const isHost = meeting?.hostId === user?.id;

  // Handlers
  const handleReaction = (emoji: string) => {
    const reaction: Reaction = {
      id: `reaction-${Date.now()}`,
      participantId: user?.id || 'unknown',
      emoji,
      timestamp: new Date()
    };
    addReaction(reaction);
    setShowReactions(false);
  };

  const handleAudioToggle = () => {
    toggleAudio();
    // Fallback to participant-1 if user is not set or ID mismatch
    const userId = user?.id;
    const participant = participants.find(p => p.id === userId)
      || participants.find(p => p.id === `participant-${userId}`)
      || participants.find(p => p.id === 'participant-1');

    if (participant) {
      updateParticipant(participant.id, { isAudioMuted: !isAudioMuted });
    }
  };

  const handleVideoToggle = () => {
    toggleVideo();
    // Fallback to participant-1
    const userId = user?.id;
    const participant = participants.find(p => p.id === userId)
      || participants.find(p => p.id === `participant-${userId}`)
      || participants.find(p => p.id === 'participant-1');

    if (participant) {
      updateParticipant(participant.id, { isVideoOff: !isVideoOff });
    }
  };

  const handleScreenShare = () => {
    setShowScreenShareOptions(true);
  };

  const handleScreenShareOption = (option: 'screen' | 'window') => {
    toggleScreenShare();
    setShowScreenShareOptions(false);
  };

  const handleLeave = () => {
    leaveMeeting();
    navigate('/');
  };

  return (
    <>
      {/* Bottom Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1C1C1C] border-t border-[#333] z-40 py-2 px-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">

          {/* Main Controls - Left/Center Aligned (Zoom style) */}
          <div className="flex items-center gap-2 md:gap-4 lg:gap-6 flex-1 justify-center md:justify-start lg:justify-center overflow-x-auto no-scrollbar">

            {/* Audio */}
            <ControlButton
              icon={isAudioMuted ? MicOff : Mic}
              label={isAudioMuted ? "Unmute" : "Mute"}
              active={isAudioMuted}
              onClick={handleAudioToggle}
              hasDropdown
            />

            {/* Video */}
            <ControlButton
              icon={isVideoOff ? VideoOff : Video}
              label={isVideoOff ? "Start Video" : "Stop Video"}
              active={isVideoOff}
              onClick={handleVideoToggle}
              hasDropdown
            />

            {/* Security (Host Only) */}
            {isHost && (
              <ControlButton
                icon={Shield}
                label="Security"
                onClick={toggleSettings}
              />
            )}

            {/* Participants */}
            <div className="relative">
              <ControlButton
                icon={Users}
                label="Participants"
                onClick={toggleParticipants}
                isActiveState={isParticipantsOpen}
                badge={participants.length}
              />
            </div>

            {/* Chat */}
            <ControlButton
              icon={MessageSquare}
              label="Chat"
              onClick={toggleChat}
              isActiveState={isChatOpen}
            />

            {/* Share Screen */}
            <div className="relative">
              <ControlButton
                icon={Share2}
                label="Share Screen"
                onClick={handleScreenShare}
                active={isScreenSharing}
                className={isScreenSharing ? "text-green-500" : "text-green-500"}
                hasDropdown
              />
              <AnimatePresence>
                {showScreenShareOptions && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#232323] border border-[#333] rounded-lg shadow-xl z-50 w-48 overflow-hidden"
                  >
                    <button onClick={() => handleScreenShareOption('screen')} className="w-full text-left px-4 py-2 hover:bg-[#333] text-sm text-white">Share Entire Screen</button>
                    <button onClick={() => handleScreenShareOption('window')} className="w-full text-left px-4 py-2 hover:bg-[#333] text-sm text-white">Share Window</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Record */}
            <ControlButton
              icon={Circle}
              label={isRecording ? "Stop Recording" : "Record"}
              onClick={toggleRecording}
              active={isRecording}
              className={isRecording ? "text-red-500" : ""}
            />

            {/* Reactions */}
            <div className="relative">
              <ControlButton
                icon={Smile}
                label="Reactions"
                onClick={() => setShowReactions(!showReactions)}
              />
              <AnimatePresence>
                {showReactions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-[#232323] border border-[#333] rounded-full p-2 flex gap-2 shadow-xl z-50"
                  >
                    {reactionEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="text-2xl hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* More */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="outline-none">
                  <ControlButton
                    icon={MoreVertical}
                    label="More"
                    onClick={() => { }}
                  />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="bg-[#232323] border-[#333] text-white">
                <DropdownMenuItem onClick={() => setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery')}>
                  {viewMode === 'gallery' ? <User className="w-4 h-4 mr-2" /> : <Grid3x3 className="w-4 h-4 mr-2" />}
                  {viewMode === 'gallery' ? 'Speaker View' : 'Gallery View'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleSettings}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>

          {/* End Button - Far Right */}
          <div className="flex-none ml-4">
            <Button
              onClick={() => setShowLeaveConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-6 py-2 h-auto"
            >
              End
            </Button>
          </div>

        </div>
      </div>

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLeaveConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#232323] border border-[#333] rounded-xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">End Meeting?</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to end or leave this meeting?
              </p>
              <div className="flex flex-col gap-3">
                {isHost && (
                  <Button
                    onClick={handleLeave} // In a real app this would end for all
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-6"
                  >
                    End Meeting for All
                  </Button>
                )}
                <Button
                  onClick={handleLeave}
                  variant={isHost ? "secondary" : "destructive"}
                  className={cn("w-full py-6", !isHost && "bg-red-600 hover:bg-red-700 text-white")}
                >
                  Leave Meeting
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="mt-2"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Helper Component for consistent button styling
interface ControlButtonProps {
  icon: any;
  label: string;
  onClick: () => void;
  active?: boolean; // Toggled state (e.g. mute is red)
  isActiveState?: boolean; // Active UI state (e.g. panel open is blue)
  hasDropdown?: boolean;
  className?: string;
  badge?: number;
}

function ControlButton({ icon: Icon, label, onClick, active, isActiveState, hasDropdown, className, badge }: ControlButtonProps) {
  return (
    <div className="group flex flex-col items-center gap-1 cursor-pointer min-w-[3.5rem]" onClick={onClick}>
      <div className="relative">
        <div className={cn(
          "relative flex items-center justify-center w-auto h-auto p-2 rounded-lg transition-colors",
          isActiveState ? "bg-[#2D2D2D] text-[#0B5CFF]" : "hover:bg-[#2D2D2D] text-gray-200",
          active && "text-red-500", // Alert state like Muted
          className
        )}>
          <Icon className={cn("w-6 h-6", active && "fill-current")} strokeWidth={1.5} />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
              {badge}
            </span>
          )}
        </div>
        {hasDropdown && (
          <div className="absolute top-0 right-0 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronUp className="w-3 h-3 text-gray-500" />
          </div>
        )}
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-gray-300 group-hover:text-white whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
