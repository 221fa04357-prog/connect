import { SonnerToaster, TooltipProvider, Toaster } from '@/components/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import { Login, Register, ResetPassword } from './pages/Auth';
import { JoinMeeting, CreateMeeting } from './pages/MeetingSetup';
import MeetingRoom from './pages/MeetingRoom';
import Settings from './pages/Settings';
import Help from './pages/Help';
import NotFound from './pages/NotFound';
import MeetingRecap from './pages/MeetingRecap';
import RecapsList from './pages/RecapsList';
import { useAuthStore } from './stores/useAuthStore';
import { useGuestSessionStore } from './stores/useGuestSessionStore';
import { useEffect, useRef } from 'react';
import { useMeetingStore } from './stores/useMeetingStore';
import { useParticipantsStore } from './stores/useParticipantsStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Move, User as UserIcon, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks';

const GlobalMiniPreview = () => {
  const {
    localStream,
    isAudioMuted,
    isVideoOff,
    toggleAudio,
    toggleVideo,
    isMiniVisible,
    setMiniVisible,
    meetingJoined,
    isInsideMeeting,
    setIsInsideMeeting
  } = useMeetingStore();
  const location = useLocation();
  const navigate = useNavigate();
  const miniVideoRef = useRef<HTMLVideoElement>(null);

  // 1. SYNC ROUTE STATE: Automatic route-based visibility
  useEffect(() => {
    const isMeetingPage = location.pathname.startsWith("/meeting");
    const isJoinPage = location.pathname.startsWith("/join-meeting");
    const isCreatePage = location.pathname.startsWith("/create-meeting");
    const isLandingPage = location.pathname === "/";
    const insideMeetingContext = isMeetingPage || isJoinPage || isCreatePage || isLandingPage;

    setIsInsideMeeting(insideMeetingContext);

    if (insideMeetingContext) {
      setMiniVisible(false); // Hide mini when actively inside meeting room
    } else if (meetingJoined) {
      setMiniVisible(true); // Automatically show mini if meeting joined and navigated away
    }
  }, [location.pathname, meetingJoined, setIsInsideMeeting, setMiniVisible]);

  // 2. MULTI-LAYER TAB-LEAVE DETECTION (Visibility, Blur, PageHide)
  useEffect(() => {
    if (!meetingJoined) return;

    const showMini = () => {
      // Force mini visible if meeting is active but focus is lost
      if (useMeetingStore.getState().isInsideMeeting) {
        setIsInsideMeeting(false);
        setMiniVisible(true);
      }
    };

    const hideMiniIfReturned = () => {
      // User is back to the app
      if (meetingJoined) {
        const isMeetingPage = location.pathname.startsWith("/meeting");
        const isJoinPage = location.pathname.startsWith("/join-meeting");
        const isCreatePage = location.pathname.startsWith("/create-meeting");
        const isLandingPage = location.pathname === "/";

        if (isMeetingPage || isJoinPage || isCreatePage || isLandingPage) {
          setIsInsideMeeting(true);
          setMiniVisible(false); // 🚨 FORCE HIDE
        }
      }
    };

    // TAB HIDDEN (MOST IMPORTANT)
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        showMini();
      } else if (document.visibilityState === "visible") {
        hideMiniIfReturned();
      }
    };

    // WINDOW LOST FOCUS (Alt+Tab)
    const handleBlur = () => {
      showMini();
    };

    // MOBILE APP SWITCH / BROWSER MINIMIZE
    const handlePageHide = () => {
      showMini();
    };

    const handleFocus = () => {
      hideMiniIfReturned();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("focus", handleFocus);
    };
  }, [meetingJoined, setIsInsideMeeting, setMiniVisible, location.pathname]);

  // 3. TRACK SYNC: Ensure hardware tracks match toggle state
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = !isAudioMuted));
      localStream.getVideoTracks().forEach((t) => (t.enabled = !isVideoOff));
    }
  }, [isAudioMuted, isVideoOff, localStream]);

  // 4. BIND STREAM: Attach live stream to the mini video reference
  useEffect(() => {
    if (miniVideoRef.current && localStream) {
      // Ensure PiP is explicitly allowed on the video element
      miniVideoRef.current.disablePictureInPicture = false;
      miniVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOff]);

  // 5. PICTURE-IN-PICTURE (PiP) ENGINE: WhatsApp/Meet Pro logic
  useEffect(() => {
    const handleVisibility = async () => {
      // Trigger PiP ONLY when meeting is active and user leaves the tab/app
      if (document.hidden && meetingJoined) {
        const video = miniVideoRef.current;
        if (video && document.pictureInPictureEnabled) {
          try {
            // Only request if not already in PiP
            if (document.pictureInPictureElement !== video && video.readyState >= 2) {
              await video.requestPictureInPicture();
            }
          } catch (err) {
            console.warn("PiP request failed:", err);
          }
        }
      }
    };

    const handleFocus = async () => {
      // Automatically exit PiP when user returns to the app
      if (document.pictureInPictureElement) {
        try {
          await document.exitPictureInPicture();
        } catch (err) {
          console.warn("Exit PiP failed:", err);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [meetingJoined, isInsideMeeting]);

  // FINAL RENDERING RULE: Show ONLY if meeting is active but user is NOT viewing it
  // Path check is ADDED to prevent duplicate mini-preview while in the meeting room
  // FINAL RENDERING RULE: Show ONLY if meeting is active but user is NOT viewing it
  // Path check is ADDED to prevent duplicate mini-preview while in the meeting room
  const isMeetingPage = location.pathname.startsWith("/meeting");
  const isJoinPage = location.pathname.startsWith("/join-meeting");
  const isCreatePage = location.pathname.startsWith("/create-meeting");
  const isLandingPage = location.pathname === "/";

  const shouldBeVisible = meetingJoined && !isInsideMeeting && isMiniVisible && !isMeetingPage && !isJoinPage && !isCreatePage && !isLandingPage;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        initial={false}
        animate={{
          opacity: shouldBeVisible ? 1 : 0,
          scale: shouldBeVisible ? 1 : 0.8,
          y: shouldBeVisible ? 0 : 20
        }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed bottom-5 right-5 z-[99999] overflow-hidden rounded-[14px] bg-black shadow-[0_10px_40px_rgba(0,0,0,0.5)] cursor-pointer group",
          "w-[220px] h-[130px]"
        )}
        style={{
          opacity: shouldBeVisible ? 1 : 0,
          pointerEvents: shouldBeVisible ? 'auto' : 'none',
          position: 'fixed'
        }}
        onClick={() => {
          setMiniVisible(false);
          navigate('/meeting');
        }}
      >
        {/* Priority 1: Live Video (Always Mounted to prevent restart) */}
        <video
          ref={miniVideoRef}
          autoPlay
          muted
          playsInline
          className={cn(
            "w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300",
            isVideoOff || !localStream ? "opacity-0 invisible" : "opacity-100 visible"
          )}
        />

        {/* Priority 2: Avatar (Always Mounted - Fallback when Camera is OFF) */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-[#1a1a1a] transition-opacity duration-300",
            !isVideoOff && localStream ? "opacity-0 invisible" : "opacity-100 visible"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center text-white text-xl font-bold border border-white/10">
            <UserIcon className="w-6 h-6 text-gray-400" />
          </div>
        </div>

        {/* HUD Overlay - Status / LIVE Badge */}
        <div className="absolute top-2 left-2 z-[2] pointer-events-none">
          <div className="bg-red-600 px-1.5 py-0.5 rounded text-[9px] text-white font-bold flex items-center gap-1 shadow-lg">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        </div>

        {/* Sync Controls: Toggles update both Hardware AND global meeting state */}
        <div className="absolute bottom-[6px] left-[6px] z-[3] flex gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAudio();
            }}
            className={cn(
              "p-1.5 rounded-full backdrop-blur-md transition-colors",
              isAudioMuted ? "bg-red-500/80 text-white" : "bg-black/60 text-white hover:bg-black/80"
            )}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleVideo();
            }}
            className={cn(
              "p-1.5 rounded-full backdrop-blur-md transition-colors",
              isVideoOff ? "bg-red-500/80 text-white" : "bg-black/60 text-white hover:bg-black/80"
            )}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
        </div>

        {/* Expand Meeting Interaction */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity pointer-events-none">
          <Maximize2 className="w-8 h-8 text-white/40" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guestSessionActive = useGuestSessionStore((state) => state.guestSessionActive);
  const checkGuestSession = useGuestSessionStore((state) => state.checkGuestSession);

  // Check guest session timer every second
  useEffect(() => {
    if (!isAuthenticated && guestSessionActive) {
      const interval = setInterval(() => {
        checkGuestSession();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, guestSessionActive, checkGuestSession]);

  if (!isAuthenticated && !guestSessionActive) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <HashRouter>
      <GlobalMiniPreview />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/join-meeting" element={
          <ProtectedRoute>
            <JoinMeeting />
          </ProtectedRoute>
        } />
        <Route path="/create-meeting" element={
          <ProtectedRoute>
            <CreateMeeting />
          </ProtectedRoute>
        } />
        <Route path="/meeting" element={
          <ProtectedRoute>
            <MeetingRoom />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="/recap/:meetingId" element={<MeetingRecap />} />
        <Route path="/recaps" element={<RecapsList />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SonnerToaster />
      <Toaster />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider >
);

export default App;
