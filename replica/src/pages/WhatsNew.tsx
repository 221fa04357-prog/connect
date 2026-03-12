import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import { ArrowLeft, Sparkles, Video, Shield, Zap } from 'lucide-react';

export default function WhatsNew() {
    const navigate = useNavigate();

    const features = [
        {
            title: "Advanced Noise Cancellation",
            description: "New AI-powered noise suppression that filters out background noise even in the busiest environments.",
            icon: <Zap className="w-6 h-6 text-yellow-500" />
        },
        {
            title: "Enhanced 4K Video Support",
            description: "Experience ultra-high-definition video quality for all participants with optimized bandwidth usage.",
            icon: <Video className="w-6 h-6 text-blue-500" />
        },
        {
            title: "End-to-End Encryption 2.0",
            description: "New security protocol ensuring all your meetings, chats and file shares are more secure than ever.",
            icon: <Shield className="w-6 h-6 text-green-500" />
        }
    ];

    return (
        <div className="min-h-screen bg-[#1C1C1C] text-white p-4 md:p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto"
            >
                <div className="bg-[#232323] rounded-3xl overflow-hidden shadow-2xl border border-[#333]">
                    {/* Hero Section */}
                    <div className="relative h-64 bg-gradient-to-br from-[#0B5CFF] to-[#003CBB] flex flex-col items-center justify-center p-8 text-center overflow-hidden">
                        <div className="absolute top-6 left-6 z-10">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                                className="bg-white/10 hover:bg-white/20 text-white rounded-full"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="absolute -right-12 -top-12 opacity-10">
                            <Sparkles className="w-64 h-64" />
                        </div>

                        <Sparkles className="w-12 h-12 text-blue-200 mb-4 animate-pulse" />
                        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-2">What's New</h2>
                        <p className="text-blue-100 text-lg opacity-80">Discover the latest features in NeuralChat 2.4.0</p>
                    </div>

                    <div className="p-8 md:p-12 space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {features.map((f, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="p-6 bg-[#1A1A1A] rounded-2xl border border-[#333] hover:border-blue-500/50 transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-[#232323] flex items-center justify-center mb-6 border border-[#333] group-hover:scale-110 transition-transform">
                                        {f.icon}
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
                                </motion.div>
                            ))}
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1 space-y-4 text-center md:text-left">
                                <h3 className="text-2xl font-bold">Ready to try the new updates?</h3>
                                <p className="text-gray-400">All features are now available for all Pro and Enterprise users across all devices.</p>
                            </div>
                            <Button
                                className="bg-white text-black hover:bg-gray-200 px-8 py-6 rounded-xl text-lg font-bold shrink-0"
                                onClick={() => navigate('/upgrade')}
                            >
                                Get Started
                            </Button>
                        </div>
                    </div>

                    <div className="p-6 bg-[#1A1A1A] border-t border-[#333] flex justify-center gap-8 text-sm text-gray-500">
                        <span className="hover:text-blue-400 cursor-pointer">Release History</span>
                        <span className="hover:text-blue-400 cursor-pointer">Documentation</span>
                        <span className="hover:text-blue-400 cursor-pointer">Support Blog</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
