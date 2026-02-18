// Zustand store for participants management

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Participant, WaitingRoomParticipant } from '@/types';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { generateMockParticipants, generateWaitingRoomParticipants } from '@/utils';
import { eventBus } from '@/lib/eventBus';

const INSTANCE_ID = eventBus.instanceId;

interface ParticipantsState {
  focusedParticipantId: string | null;
  setFocusedParticipant: (id: string | null) => void;
  participants: Participant[];
  waitingRoom: WaitingRoomParticipant[];
  transientRoles: Record<string, Participant['role'] | undefined>;
  waitingRoomEnabled: boolean;
  activeSpeakerId: string | null;
  pinnedParticipantId: string | null;
  spotlightedParticipantId: string | null;
  videoRestricted: boolean;

  // Actions
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  toggleHandRaise: (id: string) => void;
  setActiveSpeaker: (id: string | null) => void;
  pinParticipant: (id: string) => void;
  unpinParticipant: () => void;
  spotlightParticipant: (id: string) => void;
  unspotlightParticipant: () => void;
  muteParticipant: (id: string) => void;
  unmuteParticipant: (id: string) => void;
  muteAll: () => void;
  unmuteAll: () => void;
  makeHost: (id: string) => void;
  makeCoHost: (id: string) => void;
  revokeHost: (id: string) => void;
  revokeCoHost: (id: string) => void;
  setTransientRole: (id: string, role: Participant['role'] | undefined) => void;
  clearTransientRole: (id: string) => void;
  clearAllTransientRoles: () => void;
  setWaitingRoomEnabled: (enabled: boolean) => void;
  admitFromWaitingRoom: (id: string) => void;
  removeFromWaitingRoom: (id: string) => void;

  // Video Controls
  setVideoRestriction: (restricted: boolean) => void;
  setVideoAllowed: (id: string, allowed: boolean) => void;
  stopVideoAll: () => void;
  allowVideoAll: () => void;

  // Unified Toggle Actions
  toggleParticipantAudio: (id: string) => void;
  toggleParticipantVideo: (id: string) => void;
  syncParticipants: (participants: Participant[]) => void;
  reset: () => void;
}

export const useParticipantsStore = create<ParticipantsState>()(
  persist(
    (set) => ({
      participants: [], // No more mock data
      focusedParticipantId: null,
      setFocusedParticipant: (id) => set({ focusedParticipantId: id }),
      waitingRoom: [], // No more mock data
      transientRoles: {},
      waitingRoomEnabled: true,
      videoRestricted: false,
      activeSpeakerId: null,
      pinnedParticipantId: null,
      spotlightedParticipantId: null,

      setParticipants: (participants) => set({ participants }),

      addParticipant: (participant) => set((state) => {
        const p = { ...participant, isVideoAllowed: !state.videoRestricted };
        if (state.waitingRoomEnabled && p.role === 'participant') {
          const waitingEntry: WaitingRoomParticipant = { id: p.id, name: p.name, joinedAt: new Date() };
          return { waitingRoom: [...state.waitingRoom, waitingEntry] };
        }
        const res = { participants: [...state.participants, p] };
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return res;
      }),

      removeParticipant: (id) => set((state) => {
        const target = state.participants.find(p => p.id === id);
        if (target?.role === 'host') return {};
        const res = { participants: state.participants.filter(p => p.id !== id) };
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return res;
      }),

      updateParticipant: (id, updates) => set((state) => {
        const participants = state.participants.map(p =>
          p.id === id ? { ...p, ...updates } : p
        );
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      toggleHandRaise: (id) => set((state) => ({
        participants: state.participants.map(p =>
          p.id === id ? { ...p, isHandRaised: !p.isHandRaised } : p
        )
      })),

      setActiveSpeaker: (id) => set({ activeSpeakerId: id }),

      pinParticipant: (id) => set((state) => ({
        pinnedParticipantId: id,
        participants: state.participants.map(p => ({
          ...p,
          isPinned: p.id === id
        }))
      })),

      unpinParticipant: () => set((state) => ({
        pinnedParticipantId: null,
        participants: state.participants.map(p => ({ ...p, isPinned: false }))
      })),

      spotlightParticipant: (id) => set((state) => ({
        spotlightedParticipantId: id,
        participants: state.participants.map(p => ({
          ...p,
          isSpotlighted: p.id === id
        }))
      })),

      unspotlightParticipant: () => set((state) => ({
        spotlightedParticipantId: null,
        participants: state.participants.map(p => ({ ...p, isSpotlighted: false }))
      })),

      muteParticipant: (id: string) => set((state) => {
        const participants = state.participants.map(p => {
          if (p.id === id) {
            const role = state.transientRoles[p.id] || p.role;
            if (role === 'host') return p;
            return { ...p, isAudioMuted: true };
          }
          return p;
        });
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      unmuteParticipant: (id) => set((state) => {
        const participants = state.participants.map(p => {
          if (p.id === id) {
            const role = state.transientRoles[p.id] || p.role;
            if (role === 'host') return p;
            return { ...p, isAudioMuted: false };
          }
          return p;
        });
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      muteAll: () => set((state) => {
        const participants = state.participants.map(p => {
          const role = state.transientRoles[p.id] || p.role;
          if (role === 'participant' || role === 'co-host') {
            return { ...p, isAudioMuted: true };
          }
          return p;
        });
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      unmuteAll: () => set((state) => {
        const participants = state.participants.map(p => {
          const role = state.transientRoles[p.id] || p.role;
          if (role === 'participant' || role === 'co-host') {
            return { ...p, isAudioMuted: false };
          }
          return p;
        });
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      makeHost: (id: string) => {
        set((state) => {
          const currentHostCount = state.participants.filter(p => p.role === 'host').length;
          if (currentHostCount >= 2) return {};
          const next = { ...state.transientRoles };
          next[id] = ('host' as Participant['role']);
          const participants = state.participants.map(p => p.id === id ? { ...p, role: ('host' as Participant['role']) } : p);
          const res = { transientRoles: next, participants };
          setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
          return res;
        });
      },

      makeCoHost: (id: string) => {
        set((state) => {
          const currentCoHostsCheck = state.participants.filter(p => p.role === 'co-host');
          if (currentCoHostsCheck.length >= 2) return {};
          const next = { ...state.transientRoles, [id]: ('co-host' as Participant['role']) };
          const participants = state.participants.map(p => p.id === id ? { ...p, role: ('co-host' as Participant['role']) } : p);
          const res = { transientRoles: next, participants };
          setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
          return res;
        });
      },

      setTransientRole: (id: string, role) => set((state) => ({ transientRoles: { ...state.transientRoles, [id]: role } })),
      clearTransientRole: (id: string) => set((state) => {
        const next = { ...state.transientRoles };
        delete next[id];
        const participants = state.participants.map(p => p.id === id ? { ...p, role: ('participant' as Participant['role']) } : p);
        const res = { transientRoles: next, participants };
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return res;
      }),
      clearAllTransientRoles: () => set({ transientRoles: {} }),

      revokeHost: (id: string) => {
        set((state) => {
          const next = { ...state.transientRoles };
          delete next[id];
          if (state.participants.find(p => p.id === id)?.role === 'host') {
            next[id] = 'participant';
          }
          const participants = state.participants.map(p => ({
            ...p,
            role: p.id === id ? ('participant' as Participant['role']) : p.role
          }));
          const res = { transientRoles: next, participants };
          setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
          return res;
        });
      },

      revokeCoHost: (id: string) => set((state) => {
        const next = { ...state.transientRoles };
        if (next[id] === 'co-host') delete next[id];
        if (state.participants.find(p => p.id === id)?.role === 'co-host') {
          next[id] = 'participant';
        }
        const participants = state.participants.map(p => p.id === id && p.role === ('co-host' as Participant['role']) ? { ...p, role: ('participant' as Participant['role']) } : p);
        const res = { transientRoles: next, participants };
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return res;
      }),
      setWaitingRoomEnabled: (enabled: boolean) => set((state) => {
        const res = { waitingRoomEnabled: enabled } as any;
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles, waitingRoom: useParticipantsStore.getState().waitingRoom }, { source: INSTANCE_ID }));
        return res;
      }),

      admitFromWaitingRoom: (id) => set((state) => {
        const waitingParticipant = state.waitingRoom.find(p => p.id === id);
        if (!waitingParticipant) return state;
        const newParticipant: Participant = {
          id: waitingParticipant.id,
          name: waitingParticipant.name,
          role: 'participant',
          isAudioMuted: true,
          isVideoOff: true,
          isHandRaised: false,
          isSpeaking: false,
          isPinned: false,
          isSpotlighted: false,
          avatar: '#0B5CFF',
          joinedAt: new Date()
        };
        const res = {
          participants: [...state.participants, newParticipant],
          waitingRoom: state.waitingRoom.filter(p => p.id !== id)
        };
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles, waitingRoom: useParticipantsStore.getState().waitingRoom }, { source: INSTANCE_ID }));
        return res;
      }),

      removeFromWaitingRoom: (id) => set((state) => {
        const res = { waitingRoom: state.waitingRoom.filter(p => p.id !== id) };
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles, waitingRoom: useParticipantsStore.getState().waitingRoom }, { source: INSTANCE_ID }));
        return res;
      }),

      setVideoRestriction: (restricted) => set((state) => {
        const res = { videoRestricted: restricted };
        setTimeout(() => eventBus.publish('participants:update', {
          participants: useParticipantsStore.getState().participants,
          transientRoles: useParticipantsStore.getState().transientRoles,
          videoRestricted: restricted
        }, { source: INSTANCE_ID }));
        return res;
      }),

      setVideoAllowed: (id, allowed) => set((state) => {
        const participants = state.participants.map(p => {
          if (p.id === id) {
            const role = state.transientRoles[p.id] || p.role;
            if (role === 'host') return p;
            return { ...p, isVideoAllowed: allowed, isVideoOff: !allowed };
          }
          return p;
        });
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      stopVideoAll: () => set((state) => {
        const participants = state.participants.map(p => {
          const role = state.transientRoles[p.id] || p.role;
          if (role === 'participant' || role === 'co-host') {
            return { ...p, isVideoOff: true, isVideoAllowed: false };
          }
          return p;
        });
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      allowVideoAll: () => set((state) => {
        const participants = state.participants.map(p => {
          const role = state.transientRoles[p.id] || p.role;
          if (role === 'participant' || role === 'co-host') {
            return { ...p, isVideoAllowed: true, isVideoOff: false };
          }
          return p;
        });
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      toggleParticipantAudio: (id) => set((state) => {
        const participants = state.participants.map(p =>
          p.id === id ? { ...p, isAudioMuted: !p.isAudioMuted } : p
        );
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      toggleParticipantVideo: (id) => set((state) => {
        const participants = state.participants.map(p => {
          if (p.id === id) {
            const nextVideoOff = !p.isVideoOff;
            if (!nextVideoOff && p.isVideoAllowed === false) return p;
            return { ...p, isVideoOff: nextVideoOff };
          }
          return p;
        });
        setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
        return { participants };
      }),

      syncParticipants: (participants) => set({ participants }),

      reset: () => set({
        participants: [],
        waitingRoom: [],
        transientRoles: {},
        activeSpeakerId: null,
        pinnedParticipantId: null,
        spotlightedParticipantId: null,
        focusedParticipantId: null
      })
    }),
    {
      name: 'participants-store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

// Subscribe to incoming participant updates from eventBus (ignore self-originated events)
eventBus.subscribe('participants:update', (payload, meta) => {
  if (meta?.source === INSTANCE_ID) return; // ignore our own events
  if (!payload || !payload.participants) {
    return;
  }

  const { participants, transientRoles, videoRestricted } = payload;
  const updates: any = {
    participants: participants,
    transientRoles: transientRoles || {}
  };
  if (videoRestricted !== undefined) {
    updates.videoRestricted = videoRestricted;
  }
  useParticipantsStore.setState(updates);
});

// Subscription helper
export const subscribeToParticipants = (listener: (participants: Participant[]) => void) =>
  useParticipantsStore.subscribe((state) => listener(state.participants));
