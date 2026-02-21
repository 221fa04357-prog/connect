import { create } from 'zustand';

interface GuestSessionState {
  guestSessionActive: boolean;
  guestSessionExpiresAt: number | null;
  guestId: string | null;
  startGuestSession: () => void;
  endGuestSession: () => void;
  checkGuestSession: () => void;
}

const GUEST_SESSION_KEY = 'connectpro_guest_session';
const GUEST_SESSION_DURATION = 3 * 60 * 1000; // 3 minutes in ms

function saveGuestSession(expiresAt: number | null, guestId: string | null) {
  if (expiresAt && guestId) {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify({ expiresAt, guestId }));
  } else {
    localStorage.removeItem(GUEST_SESSION_KEY);
  }
}

function loadGuestSession(): { expiresAt: number | null, guestId: string | null } {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return { expiresAt: null, guestId: null };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.expiresAt) {
      return { expiresAt: parsed.expiresAt, guestId: parsed.guestId || null };
    }
    return { expiresAt: null, guestId: null };
  } catch {
    return { expiresAt: null, guestId: null };
  }
}

export const useGuestSessionStore = create<GuestSessionState>((set, get) => {
  const { expiresAt, guestId } = loadGuestSession();
  return {
    guestSessionActive: !!expiresAt && Date.now() < expiresAt,
    guestSessionExpiresAt: expiresAt,
    guestId: guestId,
    startGuestSession: () => {
      const expiresAt = Date.now() + GUEST_SESSION_DURATION;
      const guestId = `guest-${Math.random().toString(36).substr(2, 9)}`;
      saveGuestSession(expiresAt, guestId);
      set({ guestSessionActive: true, guestSessionExpiresAt: expiresAt, guestId });
    },
    endGuestSession: () => {
      saveGuestSession(null, null);
      set({ guestSessionActive: false, guestSessionExpiresAt: null, guestId: null });
    },
    checkGuestSession: () => {
      const { guestSessionExpiresAt } = get();
      if (guestSessionExpiresAt && Date.now() >= guestSessionExpiresAt) {
        get().endGuestSession();
      }
    },
  };
});
