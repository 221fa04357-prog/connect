import { create } from 'zustand';

interface GuestSessionState {
  guestSessionActive: boolean;
  guestSessionExpiresAt: number | null;
  startGuestSession: () => void;
  endGuestSession: () => void;
  checkGuestSession: () => void;
}

const GUEST_SESSION_KEY = 'connectpro_guest_session';
const GUEST_SESSION_DURATION = 2 * 60 * 1000 + 50 * 1000; // 2 min 50 sec in ms

function saveGuestSession(expiresAt: number | null) {
  if (expiresAt) {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify({ expiresAt }));
  } else {
    localStorage.removeItem(GUEST_SESSION_KEY);
  }
}

function loadGuestSession(): { expiresAt: number | null } {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return { expiresAt: null };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.expiresAt) {
      return { expiresAt: parsed.expiresAt };
    }
    return { expiresAt: null };
  } catch {
    return { expiresAt: null };
  }
}

export const useGuestSessionStore = create<GuestSessionState>((set, get) => {
  const { expiresAt } = loadGuestSession();
  return {
    guestSessionActive: !!expiresAt && Date.now() < expiresAt,
    guestSessionExpiresAt: expiresAt,
    startGuestSession: () => {
      const expiresAt = Date.now() + GUEST_SESSION_DURATION;
      saveGuestSession(expiresAt);
      set({ guestSessionActive: true, guestSessionExpiresAt: expiresAt });
    },
    endGuestSession: () => {
      saveGuestSession(null);
      set({ guestSessionActive: false, guestSessionExpiresAt: null });
    },
    checkGuestSession: () => {
      const { guestSessionExpiresAt } = get();
      if (guestSessionExpiresAt && Date.now() >= guestSessionExpiresAt) {
        get().endGuestSession();
      }
    },
  };
});
