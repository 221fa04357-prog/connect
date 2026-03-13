import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import { ArrowLeft, UserPlus, UserCircle, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { PublicClientApplication } from '@azure/msal-browser';

// Constants
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || 'your-microsoft-client-id';

// MSAL Instance setup
const msalInstance = new PublicClientApplication({
    auth: {
        clientId: MICROSOFT_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin
    }
});
// Initialize immediately but non-blocking
msalInstance.initialize().catch(console.error);

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

    // Microsoft Login Flow
    const loginMicrosoft = async () => {
        setIsConnecting('microsoft');
        setError(null);
        try {
            const response = await msalInstance.loginPopup({
                scopes: ["user.read"]
            });
            // Profile info
            const profile = response.account;
            await processSocialLogin('microsoft', {
                email: profile.username || profile.localAccountId,
                name: profile.name,
                avatar: null, // Microsoft Graph API requires another call for photos, saving UI footprint
                id: profile.localAccountId
            });
        } catch (err: any) {
            console.error('Microsoft Login Error:', err);
            setError('Microsoft sign-in was cancelled or failed.');
            setIsConnecting(null);
            // Fallback for popup blocking gracefully handles internally for MSAL if possible or prompts users
        }
    };

    const handleSocialLogin = (provider: 'google' | 'microsoft') => {
        setIsConnecting(provider);
        setError(null);
        if (provider === 'google') {
            loginGoogle();
        } else {
            loginMicrosoft();
        }
    };

    return (
        <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full bg-[#1A1A1A] rounded-3xl overflow-hidden shadow-2xl border border-white/5"
            >
                <div className="p-8 space-y-8 text-center">
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

                    <div className="space-y-4">
                        <div className="w-20 h-20 bg-[#0B5CFF]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <UserPlus className="w-10 h-10 text-[#0B5CFF]" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">Add Account</h2>
                        <p className="text-gray-400">Manage multiple accounts seamlessly with NeuralChat.</p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 pt-4">
                        <Button
                            className="w-full bg-[#0B5CFF] hover:bg-[#0948c7] h-14 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold shadow-lg shadow-blue-500/25 transition-all"
                            onClick={() => navigate('/login')}
                            disabled={!!isConnecting}
                        >
                            <UserCircle className="w-6 h-6" />
                            Sign in to Existing Account
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full bg-transparent border-white/10 hover:bg-white/5 h-14 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold border-2 disabled:opacity-50"
                            onClick={() => navigate('/register')}
                            disabled={!!isConnecting}
                        >
                            <Mail className="w-6 h-6" />
                            Create a New Account
                        </Button>
                    </div>

                    <div className="pt-6">
                        <div className="flex items-center gap-4 text-gray-500">
                            <div className="h-[1px] bg-white/10 flex-1"></div>
                            <span className="text-xs font-bold uppercase tracking-widest">Or continue with</span>
                            <div className="h-[1px] bg-white/10 flex-1"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            variant="ghost"
                            className="bg-white/5 hover:bg-white/10 h-12 rounded-xl border border-white/10 font-bold disabled:opacity-50 transition-colors"
                            onClick={() => handleSocialLogin('google')}
                            disabled={!!isConnecting}
                        >
                            {isConnecting === 'google' ? 'Connecting...' : 'Google'}
                        </Button>
                        <Button
                            variant="ghost"
                            className="bg-white/5 hover:bg-white/10 h-12 rounded-xl border border-white/10 font-bold disabled:opacity-50 transition-colors"
                            onClick={() => handleSocialLogin('microsoft')}
                            disabled={!!isConnecting}
                        >
                            {isConnecting === 'microsoft' ? 'Connecting...' : 'Microsoft'}
                        </Button>
                    </div>

                    <p className="text-[10px] text-gray-500 pt-4">
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
