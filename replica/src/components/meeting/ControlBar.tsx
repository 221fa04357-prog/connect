import { useMeetingStore } from '@/stores/useMeetingStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  Users, MoreVertical, Grid3x3,
  User, Settings, ChevronUp, Share2, Circle, Smile, X, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reaction } from '@/types';
import { useNavigate } from 'react-router-dom';

const reactionEmojis = ['👍', '❤️', '😂', '👏', '🎉', '😮'];

export default function ControlBar() {
  const navigate = useNavigate();
  // Store hooks
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
    leaveMeeting,
    setScreenShareStream,
    setRecordingStartTime
    ,
    extendMeetingTime
  } = useMeetingStore();
  const { user, isSubscribed } = useAuthStore();

  const { participants, updateParticipant } = useParticipantsStore();

  // Local state
  const [showReactions, setShowReactions] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showScreenShareOptions, setShowScreenShareOptions] = useState(false);
  const reactionsRef = useRef<HTMLDivElement | null>(null);

  // Close reactions on outside click or Escape
  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (!showReactions) return;
      const el = reactionsRef.current;
      if (el && !el.contains(e.target as Node)) {
        setShowReactions(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowReactions(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showReactions]);

  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    const userId = user?.id;
    const participant = participants.find(p => p.id === userId)
      || participants.find(p => p.id === `participant-${userId}`)
      || participants.find(p => p.id === 'participant-1');

    if (participant) {
      updateParticipant(participant.id, { isVideoOff: !isVideoOff });
    }
  };

  const handleStartScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenShareStream(stream);
      if (!isScreenSharing) toggleScreenShare();
      setShowScreenShareOptions(false);

      stream.getVideoTracks()[0].onended = () => {
        setScreenShareStream(null);
        if (isScreenSharing) toggleScreenShare();
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const handleStopScreenShare = () => {
    if (isScreenSharing) toggleScreenShare();
    setScreenShareStream(null);
    // You would typically stop the tracks here if needed, but the store update is reactive
  };

  const handleToggleValidRecording = async () => {
    if (!isSubscribed) {
      alert('Recording is a pro feature. Upgrade to record meetings.');
      return;
    }
    if (isRecording) {
      // Stop Recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      toggleRecording();
      setRecordingStartTime(null);
    } else {
      // Start Recording
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: "screen" } as any,
          audio: true // Optional
        });

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `recording-${new Date().toISOString()}.webm`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);

          // Stop all tracks to clear the red recording icon from tab
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        toggleRecording();
        setRecordingStartTime(Date.now());

      } catch (err) {
        console.error("Error starting recording:", err);
      }
    }
  };

  const handleLeave = () => {
    leaveMeeting();
    navigate('/');
  };

  return (
    <>
      {/* Bottom Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-[#333] z-40 py-3 px-4 shadow-2xl">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">

          {/* Main Controls - Center Aligned */}
          <div className="flex items-center gap-2 md:gap-3 lg:gap-4 flex-1 justify-center overflow-x-auto no-scrollbar pb-1">

            {/* Audio */}
            <DropdownMenu>
              <div className="flex items-center bg-[#1A1A1A] rounded-md overflow-hidden hover:bg-[#2A2A2A] transition-colors border border-transparent hover:border-[#444]">
                <button
                  onClick={handleAudioToggle}
                  className={cn(
                    "flex flex-col items-center justify-center w-14 h-14 px-1 py-1 gap-1 outline-none",
                    isAudioMuted && "text-red-500"
                  )}
                >
                  {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  <span className="text-[10px] sm:text-[11px] font-medium text-gray-300">
                    {isAudioMuted ? 'Unmute' : 'Mute'}
                  </span>
                </button>
                <DropdownMenuTrigger asChild>
                  <button className="h-14 px-1 hover:bg-[#3A3A3A] transition-colors flex items-start pt-2">
                    <ChevronUp className="w-3 h-3 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
              </div>
              <DropdownMenuContent className="bg-[#1A1A1A] border-[#333] text-gray-200">
                <DropdownMenuLabel>Select a Microphone</DropdownMenuLabel>
                <DropdownMenuItem>Default - Microphone (Realtek)</DropdownMenuItem>
                <DropdownMenuItem>Headset (Bluetooth)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Video */}
            <DropdownMenu>
              <div className="flex items-center bg-[#1A1A1A] rounded-md overflow-hidden hover:bg-[#2A2A2A] transition-colors border border-transparent hover:border-[#444]">
                <button
                  onClick={handleVideoToggle}
                  className={cn(
                    "flex flex-col items-center justify-center w-14 h-14 px-1 py-1 gap-1 outline-none",
                    isVideoOff && "text-red-500"
                  )}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  <span className="text-[10px] sm:text-[11px] font-medium text-gray-300">
                    {isVideoOff ? 'video' : 'video'}
                  </span>
                </button>
                <DropdownMenuTrigger asChild>
                  <button className="h-14 px-1 hover:bg-[#3A3A3A] transition-colors flex items-start pt-2">
                    <ChevronUp className="w-3 h-3 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
              </div>
              <DropdownMenuContent className="bg-[#1A1A1A] border-[#333] text-gray-200">
                <DropdownMenuLabel>Select a Camera</DropdownMenuLabel>
                <DropdownMenuItem>Integrated Webcam</DropdownMenuItem>
                <DropdownMenuItem>OBS Virtual Camera</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Participants */}
            <ControlButton
              icon={Users}
              label="Participants"
              onClick={toggleParticipants}
              isActiveState={isParticipantsOpen}
              badge={participants.length}
            />

            {/* Chat */}
            <ControlButton
              icon={MessageSquare}
              label="Chat"
              onClick={toggleChat}
              isActiveState={isChatOpen}
            />

            {/* Reactions - Moved before Share */}
            <div className="relative" ref={reactionsRef}>
              <ControlButton
                icon={Smile}
                label="Reactions"
                onClick={() => setShowReactions(!showReactions)}
              />
              <AnimatePresence>
                {showReactions && (
                  <motion.div
                    role="dialog"
                    aria-label="Reactions"
                    initial={{ opacity: 0, scale: 0.78, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                    transition={{ type: 'spring', stiffness: 720, damping: 48 }}
                    style={{ transformOrigin: 'center bottom' }}
                    className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[rgba(18,18,18,0.7)] backdrop-blur-md border border-[rgba(255,255,255,0.04)] rounded-2xl p-3 flex gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-50 min-w-[220px] justify-center"
                  >
                    {reactionEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="text-2xl transition-transform transform hover:scale-110 hover:-translate-y-0.5 motion-reduce:transform-none p-2 rounded-md bg-white/5 hover:bg-white/6 focus:outline-none"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>


            {/* Share Screen */}
            <DropdownMenu>
              <div className="relative">
                <DropdownMenuTrigger asChild>
                  <div className="group flex flex-col items-center gap-1 cursor-pointer min-w-[3.5rem]">
                    <div className={cn(
                      "relative flex items-center justify-center w-12 h-8 rounded-lg transition-colors group-hover:bg-[#2D2D2D]",
                      isScreenSharing ? "text-green-500" : "text-green-500"
                    )}>
                      <Share2 className="w-6 h-6 fill-current" />
                      <div className="absolute top-0 right-0 -mr-1">
                        <ChevronUp className="w-3 h-3 text-gray-400 group-hover:text-white" />
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium text-gray-300 group-hover:text-white whitespace-nowrap">
                      Share Screen
                    </span>
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="bg-[#1A1A1A] border-[#333] text-gray-200 w-64">
                  <DropdownMenuLabel>Sharing Options</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#333]" />
                  <DropdownMenuItem onClick={handleStartScreenShare} className="cursor-pointer">
                    <span className="flex-1">Share Screen / Window</span>
                    {isScreenSharing && <Check className="w-4 h-4 text-green-500" />}
                  </DropdownMenuItem>
                  {isScreenSharing && (
                    <DropdownMenuItem onClick={handleStopScreenShare} className="cursor-pointer text-red-400">
                      Stop Sharing
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-[#333]" />
                  <DropdownMenuItem disabled>
                    Multiple participants can share simultaneously
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    Advanced sharing options...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </div>
            </DropdownMenu>


            {/* Record */}
            <ControlButton
              icon={Circle}
              label={isRecording ? "Stop Recording" : "Record"}
              onClick={handleToggleValidRecording}
              active={isRecording}
              className={isRecording ? "text-red-500" : ""}
            />

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
              <DropdownMenuContent align="center" className="bg-[#1A1A1A] border-[#333] text-white w-48">
                <DropdownMenuItem onClick={() => setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery')} className="cursor-pointer">
                  {viewMode === 'gallery' ? <User className="w-4 h-4 mr-2" /> : <Grid3x3 className="w-4 h-4 mr-2" />}
                  {viewMode === 'gallery' ? 'Speaker View' : 'Gallery View'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleSettings} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                {isHost && (
                  <>
                    <DropdownMenuSeparator className="bg-[#333]" />
                    <DropdownMenuItem onClick={() => {
                      if (!user || !user.subscriptionPlan || user.subscriptionPlan === 'free') {
                        alert('Extending meeting time is a pro feature. Upgrade to extend.');
                        return;
                      }
                      extendMeetingTime(15);
                    }} className="cursor-pointer">
                      Extend +15 min
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (!user || !user.subscriptionPlan || user.subscriptionPlan === 'free') {
                        alert('Extending meeting time is a pro feature. Upgrade to extend.');
                        return;
                      }
                      extendMeetingTime(30);
                    }} className="cursor-pointer">
                      Extend +30 min
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (!user || !user.subscriptionPlan || user.subscriptionPlan === 'free') {
                        alert('Extending meeting time is a pro feature. Upgrade to extend.');
                        return;
                      }
                      extendMeetingTime(60);
                    }} className="cursor-pointer">
                      Extend +60 min
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

          </div>

          {/* End Button - Far Right */}
          <div className="flex-none ml-4">
            <Button
              onClick={() => setShowLeaveConfirm(true)}
              className="bg-[#E53935] hover:bg-[#D32F2F] text-white font-semibold rounded-lg px-4 py-1.5 h-auto text-sm"
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
                    onClick={handleLeave}
                    className="w-full bg-[#E53935] hover:bg-[#D32F2F] text-white py-6"
                  >
                    End Meeting for All
                  </Button>
                )}
                <Button
                  onClick={handleLeave}
                  variant={isHost ? "secondary" : "destructive"}
                  className={cn("w-full py-6", !isHost && "bg-[#E53935] hover:bg-[#D32F2F] text-white")}
                >
                  Leave Meeting
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="mt-2 text-gray-300 hover:text-white hover:bg-[#333]"
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
  className?: string;
  badge?: number;
}

function ControlButton({ icon: Icon, label, onClick, active, isActiveState, className, badge }: ControlButtonProps) {
  return (
    <div className="group flex flex-col items-center gap-1 cursor-pointer min-w-[3.5rem]" onClick={onClick}>
      <div className="relative">
        <div className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
          isActiveState ? "bg-[#333] text-[#0B5CFF]" : "hover:bg-[#333] text-gray-200",
          active && "text-red-500", // Alert state like Muted
          className
        )}>
          <Icon className={cn("w-5 h-5", active && "fill-current")} strokeWidth={2} />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
              {badge}
            </span>
          )}
        </div>
      </div>
      <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 group-hover:text-white whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
