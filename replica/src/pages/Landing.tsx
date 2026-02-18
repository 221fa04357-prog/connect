import { Button } from '@/components/ui';
import { Video, Users, Monitor, Shield, HelpCircle, FileText, ArrowRight, Calendar, RefreshCw, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGuestSessionStore } from '@/stores/useGuestSessionStore';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui';
import { Badge } from '@/components/ui';

export default function Landing() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const guestSessionActive = useGuestSessionStore((state) => state.guestSessionActive);
  const guestSessionExpiresAt = useGuestSessionStore((state) => state.guestSessionExpiresAt);
  const startGuestSession = useGuestSessionStore((state) => state.startGuestSession);

  // Start guest session on mount if not authenticated and not already started
  useEffect(() => {
    if (!isAuthenticated && !guestSessionActive) {
      startGuestSession();
    }
  }, [isAuthenticated, guestSessionActive, startGuestSession]);

  // Timer state for countdown
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (guestSessionActive && guestSessionExpiresAt) {
      const update = () => setRemaining(Math.max(0, guestSessionExpiresAt - Date.now()));
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      setRemaining(null);
    }
  }, [guestSessionActive, guestSessionExpiresAt]);

  // Redirect to login if guest session expires and not authenticated
  useEffect(() => {
    if (!isAuthenticated && guestSessionActive && remaining === 0) {
      navigate('/login');
    }
  }, [isAuthenticated, guestSessionActive, remaining, navigate]);

  const [recaps, setRecaps] = useState<any[]>([]);
  const [recapsLoading, setRecapsLoading] = useState(false);
  const API = import.meta.env.VITE_API_URL || '';

  // Fetch real recaps if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setRecapsLoading(true);
      fetch(`${API}/api/recaps`)
        .then(res => res.json())
        .then(data => {
          // Sort by timestamp descending and take the 3 most recent
          // data can be nested or already sorted, but we ensure sorting here
          const sorted = (Array.isArray(data) ? data : [])
            .map((r: any) => {
              const ts = typeof r.timestamp === 'string' ? parseInt(r.timestamp) : r.timestamp;
              return { ...r, timestamp: ts || Date.now() };
            })
            .sort((a: any, b: any) => b.timestamp - a.timestamp)
            .slice(0, 3);
          setRecaps(sorted);
          setRecapsLoading(false);
        })
        .catch(err => {
          console.error('Error fetching recaps for landing:', err);
          setRecapsLoading(false);
        });
    }
  }, [isAuthenticated, API]);

  const features = [
    {
      icon: Video,
      title: 'HD Video & Audio',
      description: 'Crystal clear video conferencing with advanced audio processing'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Work together with screen sharing, chat, and whiteboard'
    },
    {
      icon: Monitor,
      title: 'Screen Sharing',
      description: 'Share your screen with participants in real-time'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'End-to-end encryption for all your meetings'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B5CFF] via-[#1C1C1C] to-[#1C1C1C]">
      {/* ... header logic remains same ... */}
      <header className={cn("border-b border-white/10 backdrop-blur-sm relative", isAuthenticated && "hidden")}>
        <style>{`
            
            @media (max-width: 768px) {
              .mobile-header-inner {
                width: 100% !important;
                box-sizing: border-box !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding-left: 1rem !important;
                padding-right: 1rem !important;
                max-width: 100% !important;
              }
              .mobile-logo-group {
                flex-shrink: 0 !important;
                margin-right: 0;
                display: flex;
                align-items: center;
                gap: 0.5rem;
              }
              .mobile-logo-text {
                font-size: 1.25rem !important;
                white-space: nowrap !important;
                overflow: visible !important;
                text-overflow: unset !important;
                display: block;
              }
              .mobile-nav-group {
                display: flex !important;
                align-items: center !important;
                gap: 0.25rem !important;
                flex-shrink: 0 !important;
              }
              .mobile-nav-item {
                flex-shrink: 0 !important;
                white-space: nowrap !important;
                padding-left: 0.35rem !important;
                padding-right: 0.35rem !important;
                font-size: 0.875rem !important;
                height: 2.25rem !important;
                min-width: auto !important;
              }
            }
          `}</style>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between mobile-header-inner">
          <div className="flex items-center gap-2 mobile-logo-group">
            <Video className="w-8 h-8 text-white flex-shrink-0" />
            <span className="text-2xl font-bold text-white mobile-logo-text">ConnectPro</span>
          </div>
          <div className="flex items-center gap-4 mobile-nav-group">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/help')}
                  className="text-white hover:bg-white/10 mobile-nav-item"
                >
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#1C1C1C] border-[#404040] text-white">
                <p>Help</p>
              </TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              onClick={() => navigate('/login')}
              className="text-white hover:bg-white/10 mobile-nav-item"
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate('/register')}
              className="bg-white text-[#0B5CFF] hover:bg-white/90 mobile-nav-item"
            >
              Sign Up Free
            </Button>
          </div>
        </div>
      </header>

      {isAuthenticated && <Header transparent />}

      {/* Guest session timer (show only if not authenticated and guest session is active) */}
      {!isAuthenticated && guestSessionActive && remaining !== null && (
        <div className="w-full flex justify-center">
          <div
            className="max-w-xl w-full mx-2 mt-2 px-4 py-2 bg-white/10 text-white rounded-xl shadow-lg border border-white/20 flex items-center justify-center font-semibold text-base backdrop-blur-md"
            style={{
              letterSpacing: '0.01em',
            }}
          >
            <span className="mr-2 text-blue-400">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}><circle cx="10" cy="10" r="9" stroke="#3B82F6" strokeWidth="2" /><text x="10" y="15" textAnchor="middle" fontWeight="bold" fontSize="15" fill="#3B82F6" fontFamily="Segoe UI,Arial,sans-serif">G</text></svg>
            </span>
            Guest session: <span className="ml-1 mr-2 text-blue-300">{Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}</span> remaining.
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className={`w-full max-w-7xl mx-auto px-2 sm:px-4 ${isAuthenticated ? 'pt-24 pb-10' : 'py-10'} sm:py-16 md:py-20`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Video Conferencing for Everyone
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-8">
              Connect, collaborate, and create together with our powerful video conferencing platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                size="lg"
                onClick={() => isAuthenticated ? navigate('/create-meeting') : navigate('/login')}
                className="bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6"
              >
                Start New Meeting
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/join-meeting')}
                className="border-white text-white hover:bg-white/10 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6"
              >
                Join Meeting
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative flex justify-center md:justify-end w-full"
          >

          </motion.div>
        </div>
      </section>


      {/* Recent Recaps Section (only show if authenticated) */}
      {isAuthenticated && (
        <section className="w-full max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Recent Meeting Recaps</h2>
              <p className="text-gray-400 text-sm">Stay caught up with meetings you missed or attended</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/recaps')}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 group"
            >
              View All <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative min-h-[160px]">
            {recapsLoading ? (
              <div className="col-span-full flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : recaps.length > 0 ? (
              recaps.map((meeting, i) => (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  onClick={() => navigate(`/recap/${meeting.id}`)}
                  className="group cursor-pointer bg-[#1C1C1C]/50 border border-[#333] rounded-2xl p-5 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <Badge variant="secondary" className="bg-[#2A2A2A] text-gray-400 border-[#404040]">
                      RECAP
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {meeting.title}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5 line-clamp-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {meeting.date}
                    </span>
                    {meeting.time && (
                      <span className="flex items-center gap-1.5 line-clamp-1">
                        <Clock className="w-3.5 h-3.5" />
                        {meeting.time}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 line-clamp-1">
                      <Users className="w-3.5 h-3.5" />
                      {meeting.host}
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#333] flex items-center justify-between transition-opacity">
                    <span className="text-xs font-medium text-blue-400">View Details</span>
                    <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-[#333] rounded-3xl">
                <p className="text-gray-500">No meeting recaps available yet.</p>
                <Button
                  variant="link"
                  onClick={() => navigate('/create-meeting')}
                  className="text-blue-400 mt-2"
                >
                  Start your first meeting to generate a recap
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-10 sm:py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">
            Everything You Need
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-300">
            Powerful features for seamless collaboration
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 hover:bg-white/10 transition-colors min-h-[140px] flex flex-col items-center text-center"
            >
              <feature.icon className="w-8 h-8 sm:w-10 sm:h-10 text-[#0B5CFF] mb-2 sm:mb-4" />
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white mb-1 sm:mb-2">
                {feature.title}
              </h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-300">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
