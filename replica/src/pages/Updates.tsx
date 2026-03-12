import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui';
import { ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function Updates() {
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState('Just now');

    const handleCheckUpdate = () => {
        setIsChecking(true);
        // Simulate an API check for updates
        setTimeout(() => {
            setIsChecking(false);
            setLastChecked('Just now');
        }, 2500);
    };

    return (
        <div className="min-h-screen bg-[#1C1C1C] text-white p-4 md:p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
            >
                <div className="bg-[#232323] rounded-2xl overflow-hidden shadow-2xl border border-[#333]">
                    <div className="p-6 border-b border-[#404040] flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="hover:bg-[#2D2D2D] text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h2 className="text-2xl font-bold">Check for Updates</h2>
                    </div>

                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <RefreshCw className={`w-12 h-12 text-blue-500 ${isChecking ? 'animate-spin' : 'animate-none'}`} />
                            </div>
                            {!isChecking && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                >
                                    <CheckCircle2 className="absolute -bottom-1 -right-1 w-8 h-8 text-green-500 bg-[#232323] rounded-full" />
                                </motion.div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-semibold text-white">
                                {isChecking ? 'Checking for updates...' : 'Your version is up to date'}
                            </h3>
                            <p className="text-gray-400 text-sm">NeuralChat Version 2.4.0 (Latest)</p>
                        </div>

                        <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                            NeuralChat automatically checks for updates every time you launch the application to ensure you have the latest features and security improvements.
                        </p>

                        <div className="pt-4">
                            <Button
                                onClick={handleCheckUpdate}
                                disabled={isChecking}
                                className="bg-[#0B5CFF] hover:bg-[#2D8CFF] px-8 py-6 rounded-xl text-lg font-semibold min-w-[200px]"
                            >
                                {isChecking ? 'Checking...' : 'Check Again'}
                            </Button>
                        </div>
                    </div>

                    <div className="bg-[#1C1C1C] p-6 border-t border-[#404040]">
                        <div className="flex justify-between items-center text-sm text-gray-400">
                            <span>Last checked: {lastChecked}</span>
                            <span
                                onClick={() => navigate('/whats-new')}
                                className="cursor-pointer hover:text-blue-400 transition-colors underline underline-offset-4"
                            >
                                Release Notes
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
