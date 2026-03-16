import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
    user: User | null;
    accounts: User[]; // Track all logged-in accounts
    isAuthenticated: boolean;
    isSubscribed: boolean;
    isLoading: boolean;
    login: (credentials: { email: string; password?: string }) => Promise<void>;
    register: (data: { name: string; email: string; password?: string }) => Promise<void>;
    logout: () => Promise<void>;
    switchAccount: (email: string) => void;
    removeAccount: (email: string) => void;
    verifyOTP: (email: string, otp: string) => Promise<User>;
    resendOTP: (email: string) => Promise<void>;
    fetchCurrentUser: () => Promise<void>;
    setSubscription: (plan: User['subscriptionPlan']) => void;
    setAuth: (user: User) => void;
    setPassword: (credentials: { email: string; password?: string }) => Promise<void>;
}

// Helpers for localStorage
const AUTH_KEY = 'neuralchat_active_auth';
const ACCOUNTS_KEY = 'neuralchat_all_accounts';

function saveAuth(user: User | null, isAuthenticated: boolean) {
    if (isAuthenticated && user) {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ user, isAuthenticated }));
        // Also update/add in the global accounts list
        const existingRaw = localStorage.getItem(ACCOUNTS_KEY);
        let accounts: User[] = existingRaw ? JSON.parse(existingRaw) : [];
        
        // Ensure email is used as unique key to prevent duplicates (case-insensitive)
        const existingIndex = accounts.findIndex(a => a.email?.toLowerCase() === user.email?.toLowerCase());
        if (existingIndex === -1) {
            accounts.push({ ...user, lastActive: Date.now(), isLoggedOut: false });
        } else {
            accounts[existingIndex] = { ...user, lastActive: Date.now(), isLoggedOut: false };
        }
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } else {
        localStorage.removeItem(AUTH_KEY);
    }
}

function loadAuth(): { user: User | null; accounts: User[]; isAuthenticated: boolean } {
    try {
        const rawActive = localStorage.getItem(AUTH_KEY);
        const rawAccounts = localStorage.getItem(ACCOUNTS_KEY);
        const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];
        
        if (!rawActive) return { user: null, accounts, isAuthenticated: false };
        const parsed = JSON.parse(rawActive);
        
        if (parsed && parsed.user && parsed.isAuthenticated) {
            return { user: parsed.user, accounts, isAuthenticated: true };
        }
        return { user: null, accounts, isAuthenticated: false };
    } catch {
        return { user: null, accounts: [], isAuthenticated: false };
    }
}

const API = import.meta.env.VITE_API_URL || '';

export const useAuthStore = create<AuthState>((set, get) => {
    const initial = loadAuth();

    return {
        user: initial.user,
        accounts: initial.accounts,
        isAuthenticated: initial.isAuthenticated,
        isSubscribed: !!(initial.user && (initial.user as any).subscription_plan && (initial.user as any).subscription_plan !== 'free'),
        isLoading: false,

        fetchCurrentUser: async () => {
            const { user } = get();
            if (!user) return;

            try {
                const response = await fetch(`${API}/api/auth/me`, {
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
                    // Update in accounts list
                    const accounts = get().accounts.map(a => a.email === data.email ? { ...data, isLoggedOut: false } : a);
                    set({ accounts });
                    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
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
                const response = await fetch(`${API}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Login failed');
                }

                const user = await response.json();
                saveAuth(user, true);
                
                const currentAccounts = get().accounts;
                const newAccounts = currentAccounts.some(a => a.email === user.email) 
                    ? currentAccounts.map(a => a.email === user.email ? { ...user, isLoggedOut: false } : a)
                    : [...currentAccounts, { ...user, isLoggedOut: false }];
                
                set({
                    user,
                    accounts: newAccounts,
                    isAuthenticated: true,
                    isSubscribed: user.subscription_plan !== 'free',
                    isLoading: false
                });
                localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(newAccounts));
            } catch (err: any) {
                set({ isLoading: false });
                throw err;
            }
        },

        register: async (userData) => {
            set({ isLoading: true });
            try {
                const response = await fetch(`${API}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Registration failed');
                }
                set({ isLoading: false });
            } catch (err: any) {
                set({ isLoading: false });
                throw err;
            }
        },

        verifyOTP: async (email, otp) => {
            set({ isLoading: true });
            try {
                const response = await fetch(`${API}/api/auth/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Verification failed');
                }

                const user = await response.json();
                saveAuth(user, true);
                
                const currentAccounts = get().accounts;
                const newAccounts = currentAccounts.some(a => a.email === user.email) 
                    ? currentAccounts.map(a => a.email === user.email ? { ...user, isLoggedOut: false } : a)
                    : [...currentAccounts, { ...user, isLoggedOut: false }];
                
                set({
                    user,
                    accounts: newAccounts,
                    isAuthenticated: true,
                    isSubscribed: user.subscription_plan !== 'free',
                    isLoading: false
                });
                localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(newAccounts));
                return user;
            } catch (err: any) {
                set({ isLoading: false });
                throw err;
            }
        },

        resendOTP: async (email) => {
            try {
                const response = await fetch(`${API}/api/auth/resend-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to resend OTP');
                }
            } catch (err: any) {
                throw err;
            }
        },

        switchAccount: (email: string) => {
            const currentAccounts = get().accounts;
            const accountToSwitch = currentAccounts.find(a => a.email?.toLowerCase() === email?.toLowerCase());
            
            if (accountToSwitch) {
                // Ensure switching back to an account marks it as active/logged-in
                const updatedAccounts = currentAccounts.map(a => 
                    a.email?.toLowerCase() === email?.toLowerCase() ? { ...a, isLoggedOut: false } : a
                );
                
                saveAuth(accountToSwitch, true);
                set({
                    user: { ...accountToSwitch, isLoggedOut: false },
                    accounts: updatedAccounts,
                    isAuthenticated: true,
                    isSubscribed: (accountToSwitch as any).subscription_plan !== 'free'
                });
            }
        },

        removeAccount: (email: string) => {
            const newAccounts = get().accounts.filter(a => a.email !== email);
            set({ accounts: newAccounts });
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(newAccounts));
            
            // If we removed the active account, logout
            if (get().user?.email === email) {
                get().logout();
            }
        },

        logout: async () => {
            const { user, accounts } = get();
            if (user) {
                try {
                    await fetch(`${API}/api/auth/logout`, { method: 'POST' });
                } catch (err) {
                    console.error('Logout API call failed:', err);
                }
                
                // Mark this specific account as logged out in the list
                const updatedAccounts = accounts.map(a => 
                    a.email?.toLowerCase() === user.email?.toLowerCase() ? { ...a, isLoggedOut: true } : a
                );
                
                // Check if there are other accounts that are NOT logged out
                const otherActiveAccount = updatedAccounts.find(a => !a.isLoggedOut);
                
                if (otherActiveAccount) {
                    // Switch to the other active account
                    saveAuth(otherActiveAccount, true);
                    set({ 
                        user: { ...otherActiveAccount, isLoggedOut: false }, 
                        accounts: updatedAccounts,
                        isAuthenticated: true,
                        isSubscribed: !!(otherActiveAccount as any).subscription_plan && (otherActiveAccount as any).subscription_plan !== 'free'
                    });
                } else {
                    // No other active accounts, full logout
                    saveAuth(null, false);
                    set({ 
                        user: null, 
                        accounts: updatedAccounts,
                        isAuthenticated: false, 
                        isSubscribed: false 
                    });
                }
                localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
            } else {
                saveAuth(null, false);
                set({ user: null, isAuthenticated: false, isSubscribed: false });
            }
        },

        setSubscription: (plan) => {
            const { user } = get();
            if (!user) return;
            const updatedUser = { ...user, subscription_plan: plan };
            saveAuth(updatedUser, true);
            const accounts = get().accounts.map(a => a.email === user.email ? { ...updatedUser, isLoggedOut: false } : a);
            set({ user: updatedUser, accounts, isSubscribed: plan !== 'free' });
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        },

        setAuth: (user) => {
            saveAuth(user, true);
            const currentAccounts = get().accounts;
            const newAccounts = currentAccounts.some(a => a.email === user.email) 
                ? currentAccounts.map(a => a.email === user.email ? { ...user, isLoggedOut: false } : a)
                : [...currentAccounts, { ...user, isLoggedOut: false }];
            
            set({
                user,
                accounts: newAccounts,
                isAuthenticated: true,
                isSubscribed: (user as any).subscription_plan !== 'free'
            });
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(newAccounts));
        },

        setPassword: async (credentials) => {
            set({ isLoading: true });
            try {
                const response = await fetch(`${API}/api/auth/set-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to set password');
                }

                set({ isLoading: false });
            } catch (err: any) {
                set({ isLoading: false });
                throw err;
            }
        }
    };
});

export const subscribeToAuth = (listener: (auth: { user: User | null; isAuthenticated: boolean; isSubscribed: boolean }) => void) =>
    useAuthStore.subscribe((state) => listener({ user: state.user, isAuthenticated: state.isAuthenticated, isSubscribed: state.isSubscribed }));
