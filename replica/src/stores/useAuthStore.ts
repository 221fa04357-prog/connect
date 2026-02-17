import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isSubscribed: boolean;
    isLoading: boolean;
    login: (credentials: { email: string; password?: string }) => Promise<void>;
    register: (data: { name: string; email: string; password?: string }) => Promise<void>;
    logout: () => Promise<void>;
    fetchCurrentUser: () => Promise<void>;
    setSubscription: (plan: User['subscriptionPlan']) => void;
}

// Helpers for localStorage
const AUTH_KEY = 'connectpro_auth';
function saveAuth(user: User | null, isAuthenticated: boolean) {
    if (isAuthenticated && user) {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ user, isAuthenticated }));
    } else {
        localStorage.removeItem(AUTH_KEY);
    }
}
function loadAuth(): { user: User | null; isAuthenticated: boolean } {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        if (!raw) return { user: null, isAuthenticated: false };
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user && parsed.isAuthenticated) {
            return { user: parsed.user, isAuthenticated: true };
        }
        return { user: null, isAuthenticated: false };
    } catch {
        return { user: null, isAuthenticated: false };
    }
}

export const useAuthStore = create<AuthState>((set, get) => {
    const initial = loadAuth();

    return {
        user: initial.user,
        isAuthenticated: initial.isAuthenticated,
        isSubscribed: !!(initial.user && initial.user.subscriptionPlan && initial.user.subscriptionPlan !== 'free'),
        isLoading: false,

        fetchCurrentUser: async () => {
            const { user } = get();
            if (!user) return;

            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'x-user-id': user.id }
                });
                if (response.ok) {
                    const data = await response.json();
                    set({
                        user: data,
                        isAuthenticated: true,
                        isSubscribed: data.subscription_plan !== 'free'
                    });
                    saveAuth(data, true);
                } else {
                    get().logout();
                }
            } catch (err) {
                console.error('Fetch current user failed:', err);
            }
        },

        login: async (credentials) => {
            set({ isLoading: true });
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Login failed');
                }

                const user = await response.json();
                // Map snake_case from DB to camelCase if needed, though they seem consistent in current types
                saveAuth(user, true);
                set({
                    user,
                    isAuthenticated: true,
                    isSubscribed: user.subscription_plan !== 'free',
                    isLoading: false
                });
            } catch (err: any) {
                set({ isLoading: false });
                throw err;
            }
        },

        register: async (userData) => {
            set({ isLoading: true });
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Registration failed');
                }

                const user = await response.json();
                // We no longer auto-login on registration based on user request.
                // saveAuth(user, true);
                // set({
                //     user,
                //     isAuthenticated: true,
                //     isSubscribed: user.subscription_plan !== 'free',
                //     isLoading: false
                // });
                set({ isLoading: false });
            } catch (err: any) {
                set({ isLoading: false });
                throw err;
            }
        },

        logout: async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (err) {
                console.error('Logout API call failed:', err);
            }
            saveAuth(null, false);
            set({ user: null, isAuthenticated: false, isSubscribed: false });
        },

        setSubscription: (plan) => {
            const { user } = get();
            if (!user) return;
            const updatedUser = { ...user, subscription_plan: plan };
            saveAuth(updatedUser, true);
            set({ user: updatedUser, isSubscribed: plan !== 'free' });
        }
    };
});

export const subscribeToAuth = (listener: (auth: { user: User | null; isAuthenticated: boolean; isSubscribed: boolean }) => void) =>
    useAuthStore.subscribe((state) => listener({ user: state.user, isAuthenticated: state.isAuthenticated, isSubscribed: state.isSubscribed }));
