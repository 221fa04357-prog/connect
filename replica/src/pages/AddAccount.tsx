import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import { ArrowLeft, UserPlus, UserCircle, Key, Mail } from 'lucide-react';
import { useState } from 'react';

export default function AddAccount() {
    const navigate = useNavigate();
    const [isConnecting, setIsConnecting] = useState<string | null>(null);
    const API = import.meta.env.VITE_API_URL || '';

    const handleSocialLogin = (provider: 'google' | 'microsoft') => {
        setIsConnecting(provider);
        // Simulate a delay before redirection to the actual OAuth flow
        setTimeout(() => {
            window.location.href = `${API}/api/auth/${provider}`;
        }, 800);
    };

    return (
        <div className="min-h-screen bg-[#1C1C1C] text-white flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full bg-[#232323] rounded-3xl overflow-hidden shadow-2xl border border-[#333]"
            >
                <div className="p-8 space-y-8 text-center">
                    <div className="flex justify-start">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="bg-[#2D2D2D] hover:bg-[#3D3D3D] text-white rounded-full"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <UserPlus className="w-10 h-10 text-blue-500" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">Add Account</h2>
                        <p className="text-gray-400">Manage multiple accounts seamlessly with NeuralChat.</p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <Button
                            className="w-full bg-[#0B5CFF] hover:bg-[#2D8CFF] h-14 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold"
                            onClick={() => navigate('/login')}
                        >
                            <UserCircle className="w-6 h-6" />
                            Sign in to Existing Account
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full bg-transparent border-[#444] hover:bg-[#2D2D2D] h-14 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold border-2"
                            onClick={() => navigate('/register')}
                        >
                            <Mail className="w-6 h-6" />
                            Create a New Account
                        </Button>
                    </div>

                    <div className="pt-6">
                        <div className="flex items-center gap-4 text-gray-500">
                            <div className="h-[1px] bg-[#333] flex-1"></div>
                            <span className="text-xs font-bold uppercase tracking-widest">Or continue with</span>
                            <div className="h-[1px] bg-[#333] flex-1"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant="ghost"
                            className="bg-[#1A1A1A] hover:bg-[#2D2D2D] h-12 rounded-xl border border-[#333] font-bold disabled:opacity-50"
                            onClick={() => handleSocialLogin('google')}
                            disabled={!!isConnecting}
                        >
                            {isConnecting === 'google' ? 'Connecting...' : 'Google'}
                        </Button>
                        <Button
                            variant="ghost"
                            className="bg-[#1A1A1A] hover:bg-[#2D2D2D] h-12 rounded-xl border border-[#333] font-bold disabled:opacity-50"
                            onClick={() => handleSocialLogin('microsoft')}
                            disabled={!!isConnecting}
                        >
                            {isConnecting === 'microsoft' ? 'Connecting...' : 'Microsoft'}
                        </Button>
                    </div>

                    <p className="text-[10px] text-gray-500 pt-4">
                        By adding an account, you agree to our <span className="text-blue-500 cursor-pointer">Terms of Service</span> and <span className="text-blue-500 cursor-pointer">Privacy Policy</span>.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
