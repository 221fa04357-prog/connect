import { Button } from '@/components/ui/button';
import { Video, Users, Monitor, Shield, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Landing() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

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
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">ConnectPro</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-[#0B5CFF] flex items-center justify-center text-white font-semibold">
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-white">
                    <p className="text-sm font-semibold">{user?.name}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  variant="outline"
                  className="border-white text-white hover:bg-white/10 gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Video Conferencing for Everyone
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Connect, collaborate, and create together with our powerful video conferencing platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={() => isAuthenticated ? navigate('/create-meeting') : navigate('/login')}
                className="bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white text-lg px-8 py-6"
              >
                Start New Meeting
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/join-meeting')}
                className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
              >
                Join Meeting
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Meeting preview removed as requested */}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-white mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-gray-300">
            Powerful features for seamless collaboration
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 hover:bg-white/10 transition-colors"
            >
              <feature.icon className="w-12 h-12 text-[#0B5CFF] mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-300">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}