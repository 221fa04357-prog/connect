import { Button } from '@/components/ui/button';
import { Video, Users, Monitor, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGuestSessionStore } from '@/stores/useGuestSessionStore';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';

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
      {isAuthenticated ? (
        <Header transparent />
      ) : (
        <header className="border-b border-white/10 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-8 h-8 text-white" />
              <span className="text-2xl font-bold text-white">ConnectPro</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="text-white hover:bg-white/10"
              >
                Sign In
              </Button>
              <Button
                onClick={() => navigate('/register')}
                className="bg-white text-[#0B5CFF] hover:bg-white/90"
              >
                Sign Up Free
              </Button>
            </div>
          </div>
        </header>
      )}

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
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{display:'inline',verticalAlign:'middle'}}><circle cx="10" cy="10" r="9" stroke="#3B82F6" strokeWidth="2"/><text x="10" y="15" textAnchor="middle" fontWeight="bold" fontSize="15" fill="#3B82F6" fontFamily="Segoe UI,Arial,sans-serif">G</text></svg>
            </span>
            Guest session: <span className="ml-1 mr-2 text-blue-300">{Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}</span> remaining. 
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-10 sm:py-16 md:py-20">
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