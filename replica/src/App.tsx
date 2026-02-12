import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import { Login, Register, ResetPassword } from './pages/Auth';
import { JoinMeeting, CreateMeeting } from './pages/MeetingSetup';
import MeetingRoom from './pages/MeetingRoom';
import Settings from './pages/Settings';
import Help from './pages/Help';
import NotFound from './pages/NotFound';
import { useAuthStore } from './stores/useAuthStore';
import { useGuestSessionStore } from './stores/useGuestSessionStore';
import { useEffect } from 'react';
import { useMeetingStore } from './stores/useMeetingStore';
import { useParticipantsStore } from './stores/useParticipantsStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Move, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const GlobalMiniPreview = () => {
  const { meeting } = useMeetingStore();
  const { participants, activeSpeakerId } = useParticipantsStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Ensure we are fully joined to a meeting and NOT on the main room page
  const isOnMeetingPage = location.pathname.startsWith('/meeting');
  const showPreview = !!meeting && !isOnMeetingPage;

  if (!showPreview) return null;

  const activeSpeaker = participants?.find(p => p.id === activeSpeakerId) || participants?.[0];

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.8, x: 20, y: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className={cn(
          "fixed bottom-20 right-6 z-[10000] overflow-hidden rounded-xl bg-[#1A1A1A] border border-white/10 shadow-2xl transition-shadow hover:shadow-blue-500/20 group cursor-pointer",
          isMobile ? "w-[140px] h-[85px]" : "w-[240px] h-[135px]"
        )}
        onClick={() => navigate('/meeting')}
      >
        <div className="absolute inset-0 bg-[#0A0A0A] flex items-center justify-center">
          {activeSpeaker ? (
            activeSpeaker.isVideoOff ? (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                style={{ backgroundColor: activeSpeaker.avatar || '#333' }}
              >
                {activeSpeaker.name?.charAt(0) || 'M'}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <UserIcon className="w-8 h-8 text-gray-600" />
              </div>
            )
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold">
              ?
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 pointer-events-none">
          <div className="flex justify-between items-start">
            <div className="bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-medium flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              LIVE
            </div>
            <Move className="w-3 h-3 text-white/50" />
          </div>
          <div className="flex justify-between items-end">
            <span className="text-[10px] text-white font-medium truncate max-w-[60px]">
              {activeSpeaker?.name}
            </span>
            <div className="bg-blue-600 p-1 rounded-md">
              <Maximize2 className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
          <div className="flex flex-col items-center gap-1">
            <Maximize2 className="w-5 h-5 text-white" />
            <span className="text-[10px] text-white font-bold uppercase tracking-wider">Expand Meeting</span>
          </div>
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
