import { useMeetingStore } from '@/stores/useMeetingStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useChatStore } from '@/stores/useChatStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  Users, MoreVertical, Grid3x3,
  User, Settings, ChevronUp, Share2, Circle, Smile, X, Check, Hand, Lock, Sparkles, Clock, Maximize2, Minimize2
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
import SubscriptionModal from '@/components/ui/SubscriptionModal';
import ShareScreenModal from '@/components/meeting/ShareScreenModal';
import { useIsMobile } from '@/hooks/use-mobile';

const reactionEmojis = ['👍', '❤️', '😂', '👏', '🎉', '😮'];

export default function ControlBar() {
  const navigate = useNavigate();
  // Store hooks
  const {
    meeting,
    isScreenSharing,
    isRecording,
    isChatOpen,
    isParticipantsOpen,
    viewMode,
    toggleScreenShare,
    toggleRecording,
    toggleChat,
    toggleParticipants,
    toggleSettings,
    toggleAudio,
    toggleVideo,
    isAudioMuted,
    isVideoOff,
    setViewMode,
    addReaction,
    leaveMeeting,
    setScreenShareStream,
    setRecordingStartTime,
    setLocalStream,
    extendMeetingTime,
    showSelfView,
    toggleSelfView,

    // AI Companion
    toggleAICompanion,
    isAICompanionOpen,

    // Reactions
    showReactions,
    toggleReactions,

    // Whiteboard
    isWhiteboardOpen,
    toggleWhiteboard,
    setWhiteboardEditAccess,

    // Mic & Video Confirm
    showMicConfirm,
    showVideoConfirm,
    setMicConfirm,
    setVideoConfirm

  } = useMeetingStore();
  const { user, isSubscribed } = useAuthStore();

  const {
    participants,
    updateParticipant,
    toggleHandRaise,
    toggleParticipantAudio,
    toggleParticipantVideo
  } = useParticipantsStore();

  // Find current user participant
  const currentUserId = user?.id;
  const currentParticipant = participants.find(p => p.id === currentUserId)
    || participants.find(p => p.id === `participant-${currentUserId}`)
    || participants[0];

  // Use MeetingStore state for audio/video (synced from preview)
  // const isAudioMuted = currentParticipant?.isAudioMuted ?? true;
  // const isVideoOff = currentParticipant?.isVideoOff ?? true;
  const isHandRaised = !!currentParticipant?.isHandRaised;

  const isHostOrCoHost = currentParticipant?.role === 'host' || currentParticipant?.role === 'co-host';
  const videoAllowed = isHostOrCoHost || currentParticipant?.isVideoAllowed !== false;

  // Toggle hand for self
  const handleToggleHand = () => {
    if (currentParticipant) toggleHandRaise(currentParticipant.id);
  };

  // Local state
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showScreenShareOptions, setShowScreenShareOptions] = useState(false);
  const [copiedMeetingLink, setCopiedMeetingLink] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const yesButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus Yes button when modals open
  useEffect(() => {
    if (showMicConfirm || showVideoConfirm) {
      setTimeout(() => yesButtonRef.current?.focus(), 100);
    }
  }, [showMicConfirm, showVideoConfirm]);
  const { unreadCount } = useChatStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Whiteboard state
  const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'eraser'>('pen');
  const [whiteboardColor, setWhiteboardColor] = useState('#111');
  const [whiteboardSize, setWhiteboardSize] = useState(4);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<any[]>([]); // [{points, color, size, tool}]
  const [whiteboardDrawing, setWhiteboardDrawing] = useState(false);
  const [eraserPath, setEraserPath] = useState<number[][]>([]); // For eraser tool
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 });
  const isMobile = useIsMobile();

  // Chat Badge Logic
  const displayUnreadCount = !isChatOpen ? (unreadCount > 99 ? '99+' : unreadCount) : 0;

  // RBAC for Whiteboard
  const whiteboardEditAccess = meeting?.settings?.whiteboardEditAccess || 'hostOnly';
  const canEditWhiteboard =
    currentParticipant?.role === 'host' ||
    (whiteboardEditAccess === 'coHost' && currentParticipant?.role === 'co-host') ||
    (whiteboardEditAccess === 'everyone');

  // Whiteboard handlers
  const openWhiteboard = () => { if (!isWhiteboardOpen) toggleWhiteboard(); };
  const closeWhiteboard = () => {
    if (isWhiteboardOpen) toggleWhiteboard();
    setWhiteboardDrawing(false);
    setEraserPath([]);
  };
  const clearWhiteboard = () => {
    if (!canEditWhiteboard) return;
    setWhiteboardStrokes([]);
    setWhiteboardDrawing(false);
    setEraserPath([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Drawing logic (frontend only, no backend)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEditWhiteboard) return;
    setWhiteboardDrawing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (whiteboardTool === 'pen') {
      setWhiteboardStrokes((prev) => [...prev, { points: [[x, y]], color: whiteboardColor, size: whiteboardSize, tool: 'pen' }]);
    } else if (whiteboardTool === 'eraser') {
      setEraserPath([[x, y]]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!whiteboardDrawing || !canEditWhiteboard) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (whiteboardTool === 'pen') {
      setWhiteboardStrokes((prev) => {
        if (!prev.length) return prev;
        const last = { ...prev[prev.length - 1] };
        last.points = [...last.points, [x, y]];
        return [...prev.slice(0, -1), last];
      });
    } else if (whiteboardTool === 'eraser') {
      setEraserPath((prev) => [...prev, [x, y]]);
      // Erase strokes that intersect with eraser path
      setWhiteboardStrokes((prev) => {
        const eraserRadius = whiteboardSize * 2;
        return prev.filter(stroke => {
          // If any point in stroke is close to eraser path, remove stroke
          return !stroke.points.some(([sx, sy]) => {
            return eraserPath.some(([ex, ey]) => (
              Math.sqrt((sx - ex) ** 2 + (sy - ey) ** 2) < eraserRadius
            ));
          });
        });
      });
    }
  };

  const handlePointerUp = () => {
    setWhiteboardDrawing(false);
    setEraserPath([]);
  };

  // Canvas redraw logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Set actual size in memory (scaled to extra pixels)
    canvas.width = canvasDims.w * dpr;
    canvas.height = canvasDims.h * dpr;

    // Normalize coordinate system to logical pixels
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasDims.w, canvasDims.h);
    whiteboardStrokes.forEach(stroke => {
      ctx.strokeStyle = stroke.tool === 'pen' ? stroke.color : '#fff';
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      stroke.points.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }, [whiteboardStrokes, canvasDims, whiteboardTool]);

  // Resize canvas on open and window resize
  useEffect(() => {
    if (!isWhiteboardOpen) return;
    const updateDims = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setCanvasDims({ w, h });
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, [isWhiteboardOpen]);

  // Resize canvas on open

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && showReactions) toggleReactions();
    }
    function handleDocClick(e: MouseEvent) {
      // ...existing code or leave empty if not needed...
    }
    document.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleDocClick);
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleDocClick);
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
    toggleReactions();
  };

  const handleAudioToggle = () => {
    setMicConfirm(true);
  };

  const confirmAudioToggle = async () => {
    setMicConfirm(false);
    const currentIsMuted = isAudioMuted;
    const currentStream = useMeetingStore.getState().localStream;

    // Check if any audio tracks are 'ended'
    const hasEndedTrack = currentStream?.getAudioTracks().some(t => t.readyState === 'ended');

    // If we are unmuting and have no active stream or ended track, try to get it here (user gesture)
    if (currentIsMuted && (!currentStream || !currentStream.active || currentStream.getAudioTracks().length === 0 || hasEndedTrack)) {
      try {
        console.log("Requesting audio stream on user gesture...");
        const isVideoOff = useMeetingStore.getState().isVideoOff;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: !isVideoOff
        });

        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to get audio stream on toggle:", err);
      }
    }

    toggleAudio();
    const userId = user?.id;
    const participant = participants.find(p => p.id === userId)
      || participants.find(p => p.id === `participant-${userId}`)
      || participants.find(p => p.id === 'participant-1');

    if (participant) {
      updateParticipant(participant.id, { isAudioMuted: !currentIsMuted });
    }
  };

  const handleVideoToggle = () => {
    if (!videoAllowed) {
      alert("The host has disabled video for participants.");
      return;
    }
    setVideoConfirm(true);
  };

  const confirmVideoToggle = async () => {
    setVideoConfirm(false);
    const currentIsVideoOff = isVideoOff;
    const currentStream = useMeetingStore.getState().localStream;

    // Check if any video tracks are 'ended'
    const hasEndedTrack = currentStream?.getVideoTracks().some(t => t.readyState === 'ended');

    // If we are turning video ON and have no active video track or ended track, try to get it here (user gesture)
    if (currentIsVideoOff && (!currentStream || !currentStream.active || currentStream.getVideoTracks().length === 0 || hasEndedTrack)) {
      try {
        console.log("Requesting video stream on user gesture...");
        const isAudioMutedCurrent = useMeetingStore.getState().isAudioMuted;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: !isAudioMutedCurrent
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to get video stream on toggle:", err);
      }
    }

    toggleVideo();
    const userId = user?.id;
    const participant = participants.find(p => p.id === userId)
      || participants.find(p => p.id === `participant-${userId}`)
      || participants.find(p => p.id === 'participant-1');

    if (participant) {
      updateParticipant(participant.id, { isVideoOff: !currentIsVideoOff });
    }
  };

  // Centralized Stop Sharing
  const handleStopScreenShare = () => {
    // 1. Get current stream from store or ref if needed (store is best source of truth)
    const currentStream = useMeetingStore.getState().screenShareStream;

    // 2. Stop all tracks securely
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    // 3. Update Store State
    setScreenShareStream(null);
    if (useMeetingStore.getState().isScreenSharing) {
      toggleScreenShare(); // Turn off
    }
  };

  const handleShareClick = () => {
    if (isScreenSharing) {
      handleStopScreenShare();
    } else {
      // Direct start - bypassing intermediate modal
      handleStartScreenShare();
    }
  };

  const handleStartScreenShare = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("Screen sharing is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor' // Hint to browser to default to entire screen
        } as MediaTrackConstraints,
        audio: true
      });

      // 1. Set stream immediately
      setScreenShareStream(stream);

      // 2. Set state if not already
      if (!useMeetingStore.getState().isScreenSharing) {
        toggleScreenShare();
      }

      setShowScreenShareOptions(false);

      // 3. Handle external stop (e.g. browser UI "Stop Sharing" button)
      stream.getVideoTracks()[0].onended = () => {
        handleStopScreenShare();
      };

    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  // Copy meeting link to clipboard (falls back to alert with the link)
  const handleCopyMeetingLink = async () => {
    const link = meeting?.id ? `${window.location.origin}/join/${meeting.id}` : window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        setCopiedMeetingLink(true);
        setTimeout(() => setCopiedMeetingLink(false), 2000);
      } else {
        // Fallback
        window.prompt('Copy meeting link', link);
      }
    } catch (err) {
      console.error('Copy failed', err);
      // Final fallback
      alert('Unable to copy automatically. Here is the link:\n' + link);
    }
  };

  const handleToggleValidRecording = async () => {
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
        if (typeof MediaRecorder === 'undefined') {
          alert("Media recording is not supported in this browser.");
          return;
        }

        // Check if both mic and camera are on
        if (isAudioMuted || isVideoOff) {
          alert("Please turn ON both your camera and microphone to start recording.");
          return;
        }

        // Use local stream (User Camera) to start instantly without Browser Picker Dialog
        const stream = useMeetingStore.getState().localStream;

        if (!stream) {
          console.error("No local camera stream available to record.");
          alert("Unable to access camera or microphone stream.");
          return;
        }

        // Check for supported mime types
        const types = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4',
        ];

        const supportedType = types.find(type => MediaRecorder.isTypeSupported(type));

        if (!supportedType) {
          console.error("No supported mime type found for MediaRecorder");
          alert("Recording is not supported on this browser.");
          return;
        }

        console.log(`Starting recording with type: ${supportedType}`);
        const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const extension = supportedType.includes('video/mp4') ? 'mp4' : 'webm';
          const blob = new Blob(chunksRef.current, { type: supportedType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `recording-${new Date().toISOString()}.${extension}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);

          // NOTE: Do NOT stop tracks here, as this is the live camera stream.
        };

        mediaRecorder.start();
        toggleRecording();
        setRecordingStartTime(Date.now());

      } catch (err) {
        console.error("Error starting recording:", err);
        alert(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const handleLeave = () => {
    leaveMeeting();
    navigate('/');
  };

  // Helper for checking subscription
  const handleExtendMeeting = (minutes: number) => {
    if (!user || !user.subscriptionPlan || user.subscriptionPlan === 'free') {
      setShowUpgradeModal(true);
      return;
    }
    extendMeetingTime(minutes);
  };

  // Keyboard Shortcuts (Alt + Letter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;

      const key = e.key.toLowerCase();

      // Don't trigger if user is typing in an input/textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (key) {
        case 'a':
          e.preventDefault();
          handleAudioToggle();
          break;
        case 'v':
          e.preventDefault();
          handleVideoToggle();
          break;
        case 's':
          e.preventDefault();
          handleShareClick();
          break;
        case 'd':
          e.preventDefault();
          handleToggleValidRecording();
          break;
        case 'c':
          e.preventDefault();
          toggleChat();
          break;
        case 'p':
          e.preventDefault();
          toggleParticipants();
          break;
        case 'r':
          e.preventDefault();
          toggleReactions();
          break;
        case 'h':
          e.preventDefault();
          handleToggleHand();
          break;
        case 'w':
          e.preventDefault();
          if (isWhiteboardOpen) closeWhiteboard();
          else openWhiteboard();
          break;
        case 'i':
          e.preventDefault();
          toggleAICompanion();
          break;
        case 'g':
          e.preventDefault();
          setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery');
          break;
        case 't':
          e.preventDefault();
          toggleSettings();
          break;
        case 'o':
          e.preventDefault();
          toggleSelfView();
          break;
        case 'l':
          e.preventDefault();
          handleLeave();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAudioMuted, isVideoOff, isScreenSharing, isRecording, isChatOpen,
    isParticipantsOpen, showReactions, isWhiteboardOpen, isAICompanionOpen,
    viewMode, showSelfView, handleAudioToggle, handleVideoToggle, handleShareClick,
    handleToggleValidRecording, toggleChat, toggleParticipants, toggleReactions,
    handleToggleHand, toggleAICompanion, setViewMode, toggleSettings, toggleSelfView,
    handleLeave
  ]);

  return (
    <>
      {/* Bottom Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-[#333] z-40 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] px-4 shadow-2xl">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">

          {/* Main Controls - Center Aligned */}
          <div className="flex items-center gap-4 md:gap-3 lg:gap-4 flex-1 justify-start md:justify-center overflow-x-auto no-scrollbar pb-1 px-2">

            {/* Audio */}
            <DropdownMenu>
              <div className="flex-none flex items-center bg-[#1A1A1A] rounded-md overflow-hidden hover:bg-[#2A2A2A] transition-colors border border-transparent hover:border-[#444]">
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
              <div className={cn(
                "flex-none flex items-center bg-[#1A1A1A] rounded-md overflow-hidden transition-colors border border-transparent",
                videoAllowed ? "hover:bg-[#2A2A2A] hover:border-[#444]" : "opacity-50 cursor-not-allowed"
              )}>
                <button
                  onClick={handleVideoToggle}
                  disabled={!videoAllowed}
                  className={cn(
                    "flex flex-col items-center justify-center w-14 h-14 px-1 py-1 gap-1 outline-none",
                    isVideoOff && "text-red-500",
                    !videoAllowed && "text-gray-500"
                  )}
                >
                  {!videoAllowed ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                    isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />
                  )}
                  <span className="text-[10px] sm:text-[11px] font-medium text-gray-300">
                    Video
                  </span>
                </button>
                <DropdownMenuTrigger asChild disabled={!videoAllowed}>
                  <button disabled={!videoAllowed} className="h-14 px-1 hover:bg-[#3A3A3A] transition-colors flex items-start pt-2">
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
              badge={displayUnreadCount}
            />

            {/* Reactions Button */}
            <ControlButton
              icon={Smile}
              label="Reactions"
              onClick={toggleReactions}
            />

            {/* 🔥 INLINE REACTIONS STRIP (NOT A POPUP) */}
            <AnimatePresence>
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="
                    fixed
                    bottom-[80px]
                    left-0
                    right-0
                    z-40
                    flex
                    justify-center
                    gap-4
                    py-2
                  "
                >
                  {reactionEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Share Screen */}
            <DropdownMenu>
              <div className="relative flex-none">
                <DropdownMenuTrigger asChild>
                  <div className="group flex flex-col items-center gap-1 cursor-pointer min-w-[3.5rem]">
                    <div className={cn(
                      "relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                      "hover:bg-[#333] text-gray-200"
                    )}>
                      <Share2 className="w-5 h-5" strokeWidth={2} />
                      <div className="absolute top-0 right-0 -mr-1">
                        <ChevronUp className="w-3 h-3 text-gray-400 group-hover:text-white" />
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 group-hover:text-white whitespace-nowrap">
                      Share Screen
                    </span>
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="bg-[#1A1A1A] border-[#333] text-gray-200 w-64">
                  <DropdownMenuLabel>Sharing Options</DropdownMenuLabel>

                  {/* Copy meeting link */}
                  <DropdownMenuItem onClick={handleCopyMeetingLink} className="cursor-pointer flex items-center justify-between">
                    <span className="flex-1">Share Meeting Link</span>
                    {copiedMeetingLink ? (
                      <span className="text-xs text-green-400 font-semibold">Copied</span>
                    ) : (
                      <span className="text-xs text-gray-400">Copy</span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-[#333]" />
                  <DropdownMenuItem onClick={handleShareClick} className="cursor-pointer">
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

            {/* Record Button */}
            <ControlButton
              icon={Circle}
              label={isRecording ? "Stop Recording" : "Record"}
              onClick={handleToggleValidRecording}
              active={isRecording}
              className={isRecording ? "text-red-500" : ""}
            />

            {/* Fullscreen Button */}
            <ControlButton
              icon={isFullscreen ? Minimize2 : Maximize2}
              label="Fullscreen"
              onClick={toggleFullscreen}
            />

            {/* More */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="outline-none flex-none">
                  <ControlButton
                    icon={MoreVertical}
                    label="More"
                    onClick={() => { }}
                    isActiveState={isHandRaised}
                  />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="bg-[#18181b] border-[#333] text-gray-200 w-56 shadow-xl rounded-lg">
                <DropdownMenuItem onClick={openWhiteboard} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Whiteboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleAICompanion} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Companion
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleHand} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                  <Hand className={cn("w-4 h-4 mr-2", isHandRaised ? 'text-yellow-400' : '')} />
                  {isHandRaised ? 'Lower Hand' : 'Raise Hand'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery')} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                  {viewMode === 'gallery' ? <User className="w-4 h-4 mr-2" /> : <Grid3x3 className="w-4 h-4 mr-2" />}
                  {viewMode === 'gallery' ? 'Speaker View' : 'Gallery View'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleSelfView} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                  {showSelfView ? <Check className="w-4 h-4 mr-2" /> : <div className="w-4 h-4 mr-2" />}
                  Show Self View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleSettings} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                {isHost && !isSubscribed && (
                  <DropdownMenuItem onClick={() => setShowUpgradeModal(true)} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                    <Clock className="w-4 h-4 mr-2" />
                    Extend Meeting
                  </DropdownMenuItem>
                )}
                {isHost && isSubscribed && (
                  <DropdownMenuItem onClick={() => handleExtendMeeting(15)} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                    <Clock className="w-4 h-4 mr-2" />
                    Extend Meeting +15 min
                  </DropdownMenuItem>
                )}
                {isHost && isSubscribed && (
                  <DropdownMenuItem onClick={() => handleExtendMeeting(30)} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                    <Clock className="w-4 h-4 mr-2" />
                    Extend Meeting +30 min
                  </DropdownMenuItem>
                )}
                {isHost && isSubscribed && (
                  <DropdownMenuItem onClick={() => handleExtendMeeting(60)} className="cursor-pointer flex items-center gap-2 text-gray-200 hover:bg-[#232323]">
                    <Clock className="w-4 h-4 mr-2" />
                    Extend Meeting +60 min
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Whiteboard Overlay (must be outside DropdownMenuContent) */}
            {isWhiteboardOpen && (
              <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white">
                {/* Controls overlay: ensure z-index and pointer-events */}
                <div className={cn(
                  "absolute top-0 left-0 w-full flex items-center justify-between z-[102] pointer-events-auto",
                  isMobile ? "px-4 py-3 bg-white border-b border-gray-200" : "px-6 py-4 bg-white/90 border-b border-[#e5e7eb]"
                )}>
                  {/* Left Group: Title */}
                  <div className="flex items-center gap-3">
                    <span className={cn("font-bold text-gray-900 flex-none", isMobile ? "text-lg" : "text-lg")}>Whiteboard</span>
                  </div>

                  {/* Right Group: Dropdown + Cose */}
                  <div className="flex items-center gap-2">
                    {isHost && (
                      <div className={cn(!isMobile && "flex items-center gap-2")}>
                        <span className={cn("text-gray-600 font-medium whitespace-nowrap hidden", !isMobile && "inline text-sm")}>
                          Who can edit?
                        </span>
                        <select
                          value={whiteboardEditAccess}
                          onChange={(e) => setWhiteboardEditAccess(e.target.value as any)}
                          className={cn(
                            "bg-gray-100 border border-gray-300 rounded px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm",
                            isMobile && "bg-gray-50 border-gray-200 rounded-lg py-1.5 w-[110px] text-sm"
                          )}
                        >
                          <option value="hostOnly">Only Host</option>
                          <option value="coHost">Host + Co-host</option>
                          <option value="everyone">Everyone</option>
                        </select>
                      </div>
                    )}

                    <div className="flex gap-2 items-center flex-none">
                      {canEditWhiteboard && (
                        <button
                          type="button"
                          onClick={() => { clearWhiteboard(); }}
                          className={cn(
                            "text-gray-600 hover:text-gray-900 px-3 py-1 rounded transition-colors font-medium",
                            isMobile && "hidden"
                          )}
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { closeWhiteboard(); }}
                        className={cn(
                          "text-gray-600 hover:text-gray-900 px-3 py-1 rounded transition-colors ml-2",
                          isMobile && "p-1"
                        )}
                      >
                        <X className={isMobile ? "w-6 h-6" : "w-5 h-5"} />
                      </button>
                    </div>
                  </div>
                </div>

                {canEditWhiteboard && (
                  <div
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 z-[102] bg-white rounded-xl border border-gray-200 shadow-xl flex items-center gap-4 transition-all",
                      isMobile ? "top-16 max-w-[90vw] overflow-x-auto no-scrollbar scroll-smooth p-2" : "top-20 px-4 py-2"
                    )}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <div className={cn("flex items-center gap-4", isMobile ? "min-w-max px-2" : "")}>
                      {/* Pen/Eraser toggle */}
                      <div className="flex bg-gray-100 p-1 rounded-lg flex-none">
                        <button
                          onClick={() => setWhiteboardTool('pen')}
                          className={cn(
                            "px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                            whiteboardTool === 'pen' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                          )}
                        >
                          Pen
                        </button>
                        <button
                          onClick={() => setWhiteboardTool('eraser')}
                          className={cn(
                            "px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                            whiteboardTool === 'eraser' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                          )}
                        >
                          Eraser
                        </button>
                      </div>
                      <div className="w-px h-6 bg-gray-200 flex-none" />
                      {/* Color picker */}
                      <div className="flex gap-2 items-center flex-none">
                        {['#111111', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'].map(c => (
                          <button
                            key={c}
                            onClick={() => setWhiteboardColor(c)}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex-none",
                              whiteboardColor === c ? 'border-blue-500 scale-110' : 'border-transparent'
                            )}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <div className="w-px h-6 bg-gray-200 flex-none" />
                      {/* Size picker */}
                      <div className="flex items-center gap-2 flex-none">
                        <select
                          value={whiteboardSize}
                          onChange={e => setWhiteboardSize(Number(e.target.value))}
                          className="bg-gray-50 text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {[2, 4, 8, 12, 16].map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                      </div>
                      {isMobile && (
                        <>
                          <div className="w-px h-6 bg-gray-200 flex-none" />
                          <button
                            type="button"
                            onClick={() => { clearWhiteboard(); }}
                            className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-bold flex-none"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Canvas: ensure controls overlay is above canvas */}
                <canvas
                  ref={canvasRef}
                  className={cn(
                    "absolute inset-0 w-full h-full z-[101]",
                    canEditWhiteboard ? "cursor-crosshair" : "cursor-default"
                  )}
                  style={{
                    zIndex: 101,
                    pointerEvents: canEditWhiteboard ? 'auto' : 'none',
                    touchAction: 'none'
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
              </div>
            )}

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

      <SubscriptionModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />

      <ShareScreenModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        onConfirm={handleStartScreenShare}
      />

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
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

      {/* Mic Confirmation Modal */}
      <AnimatePresence>
        {showMicConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => setMicConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1C1C1C] border border-[#333] rounded-xl p-5 max-w-[320px] w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-2">Microphone</h3>
              <p className="text-gray-400 text-sm mb-6">
                Are you sure you want to {isAudioMuted ? 'unmute' : 'mute'} your microphone?
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setMicConfirm(false)}
                  className="text-gray-300 hover:text-white hover:bg-[#333]"
                >
                  Cancel
                </Button>
                <Button
                  ref={yesButtonRef}
                  onClick={confirmAudioToggle}
                  className="bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white px-6"
                >
                  Yes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Confirmation Modal */}
      <AnimatePresence>
        {showVideoConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => setVideoConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1C1C1C] border border-[#333] rounded-xl p-5 max-w-[320px] w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-2">Camera</h3>
              <p className="text-gray-400 text-sm mb-6">
                Are you sure you want to {isVideoOff ? 'turn on' : 'turn off'} your camera?
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setVideoConfirm(false)}
                  className="text-gray-300 hover:text-white hover:bg-[#333]"
                >
                  Cancel
                </Button>
                <Button
                  ref={yesButtonRef}
                  onClick={confirmVideoToggle}
                  className="bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white px-6"
                >
                  Yes
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
  badge?: number | string;
}

// Remove ref usage from ControlButton, ensure no ref is passed to function component
function ControlButton({ icon: Icon, label, onClick, active, isActiveState, className, badge }: ControlButtonProps) {
  return (
    <div
      className={cn("group flex flex-col items-center gap-1 cursor-pointer min-w-[3.5rem] flex-none", className)}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={label}
    >
      <div className="relative">
        <div className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
          isActiveState ? "bg-[#333] text-[#0B5CFF]" : "hover:bg-[#333] text-gray-200",
          active && "text-red-500",
          className
        )}>
          <Icon className={cn("w-5 h-5", active && "fill-current")} strokeWidth={2} />
          {badge !== undefined && (typeof badge === 'number' ? badge > 0 : badge.length > 0) && (
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
