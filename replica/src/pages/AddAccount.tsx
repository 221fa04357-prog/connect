import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import { ArrowLeft, UserPlus, UserCircle, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

// Constants
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || 'your-microsoft-client-id';



function AddAccountInner() {
    const navigate = useNavigate();
    const [isConnecting, setIsConnecting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const setAuth = useAuthStore((state) => state.setAuth);
    const API = import.meta.env.VITE_API_URL || '';

    // Handle social login callback to our backend
    const processSocialLogin = async (provider: 'google' | 'microsoft', payload: any) => {
        try {
            const response = await fetch(`${API}/api/auth/social`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, provider })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Authentication failed');
            }

            const user = await response.json();
            setAuth(user);
            navigate('/');
        } catch (err: any) {
            console.error('Social auth flow failed:', err);
            setError(err.message || 'Authentication process failed.');
            setIsConnecting(null);
        }
    };

    // Google Login Flow
    const loginGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                // Fetch user info from Google
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const profile = await res.json();
                await processSocialLogin('google', {
                    email: profile.email,
                    name: profile.name,
                    avatar: profile.picture,
                    id: profile.sub
                });
            } catch (err) {
                console.error('Failed to fetch Google profile', err);
                setError('Failed to fetch your Google profile.');
                setIsConnecting(null);
            }
        },
        onError: (errorResponse) => {
            console.error('Google Login Error:', errorResponse);
            setError('Google sign-in was cancelled or failed.');
            setIsConnecting(null);
        },
        flow: 'implicit'
    });



    const handleSocialLogin = () => {
        setIsConnecting('google');
        setError(null);
        loginGoogle();
    };

    return (
        <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full bg-[#1A1A1A] rounded-3xl overflow-hidden shadow-2xl border border-white/5"
            >
                <div className="p-6 space-y-4 text-center">
                    <div className="flex justify-start">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="space-y-1">
                        <div className="w-16 h-16 bg-[#0B5CFF]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                            <UserPlus className="w-8 h-8 text-[#0B5CFF]" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">Add Account</h2>
                        <p className="text-gray-400">Manage multiple accounts seamlessly with NeuralChat.</p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 pt-4">
                        <Button
                            className="w-full bg-[#0B5CFF] hover:bg-[#0948c7] h-12 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold shadow-lg shadow-blue-500/25 transition-all"
                            onClick={() => navigate('/login')}
                            disabled={!!isConnecting}
                        >
                            <UserCircle className="w-6 h-6" />
                            Sign in to Existing Account
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full bg-transparent border-white/10 hover:bg-white/5 h-12 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold border-2 disabled:opacity-50"
                            onClick={() => navigate('/register')}
                            disabled={!!isConnecting}
                        >
                            <Mail className="w-6 h-6" />
                            Create a New Account
                        </Button>
                    </div>

                    <div className="pt-5">
                        <div className="flex items-center gap-4 text-gray-500">
                            <div className="h-[1px] bg-white/10 flex-1"></div>
                            <span className="text-xs font-bold uppercase tracking-widest">Or continue with</span>
                            <div className="h-[1px] bg-white/10 flex-1"></div>
                        </div>
                    </div>

                    <div className="pt-3 flex justify-center">
                        <Button
                            variant="ghost"
                            className="w-full bg-white/5 hover:bg-white/10 h-12 rounded-xl border border-white/10 font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            onClick={() => handleSocialLogin()}
                            disabled={!!isConnecting}
                        >
                            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            {isConnecting === 'google' ? 'Connecting...' : 'Continue with Google'}
                        </Button>
                    </div>

                    <p className="text-[10px] text-gray-500 pt-5">
                        By adding an account, you agree to our <span className="text-[#0B5CFF] cursor-pointer">Terms of Service</span> and <span className="text-[#0B5CFF] cursor-pointer">Privacy Policy</span>.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default function AddAccount() {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AddAccountInner />
        </GoogleOAuthProvider>
    );
}
