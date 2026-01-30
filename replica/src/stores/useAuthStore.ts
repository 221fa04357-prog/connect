import { create } from 'zustand';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    login: (user: User) => void;
    logout: () => void;
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

export const useAuthStore = create<AuthState>((set) => {
    const initial = loadAuth();
    return {
        user: initial.user,
        isAuthenticated: initial.isAuthenticated,
        login: (user) => {
            saveAuth(user, true);
            set({ user, isAuthenticated: true });
        },
        logout: () => {
            saveAuth(null, false);
            set({ user: null, isAuthenticated: false });
        },
    };
});
