// Zustand store for participants management

import { create } from 'zustand';
import { Participant, WaitingRoomParticipant } from '@/types';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { generateMockParticipants, generateWaitingRoomParticipants } from '@/utils/mockData';
import { eventBus } from '@/lib/eventBus';

const INSTANCE_ID = eventBus.instanceId;

interface ParticipantsState {
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
}

// TODO: Connect to backend WebSocket for real-time participant updates
// WebSocket endpoint: ws://api.example.com/meeting/{meetingId}/participants

export const useParticipantsStore = create<ParticipantsState>((set) => ({
  participants: generateMockParticipants(8).map(p => ({ ...p, isVideoAllowed: true })), // Default allowed
  waitingRoom: generateWaitingRoomParticipants(),
  transientRoles: {},
  waitingRoomEnabled: true,
  videoRestricted: false,
  activeSpeakerId: null,
  pinnedParticipantId: null,
  spotlightedParticipantId: null,

  setParticipants: (participants) => set({ participants }),

  // TODO: Broadcast via WebSocket
  // WS message: { type: 'participant_joined', data: participant }
  addParticipant: (participant) => set((state) => {
    // If video is restricted, new participants start with video disallowed
    const p = { ...participant, isVideoAllowed: !state.videoRestricted };

    // If waiting room feature is enabled, route new non-host participants to waitingRoom
    if (state.waitingRoomEnabled && p.role === 'participant') {
      const waitingEntry: WaitingRoomParticipant = { id: p.id, name: p.name, joinedAt: new Date() };
      return { waitingRoom: [...state.waitingRoom, waitingEntry] };
    }
    const res = { participants: [...state.participants, p] };
    // publish updated participants
    setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
    return res;
  }),

  // TODO: Broadcast via WebSocket
  // WS message: { type: 'participant_left', data: { participantId } }
  removeParticipant: (id) => set((state) => {
    // Prevent removing the current host directly
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

  // TODO: Broadcast hand raise via WebSocket
  // WS message: { type: 'hand_raise', data: { participantId, isRaised } }
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

  // TODO: Host control - mute participant
  // POST /api/meeting/{meetingId}/participants/{participantId}/mute
  muteParticipant: (id: string) => set((state) => {
    const participants = state.participants.map(p => {
      if (p.id === id) {
        const role = state.transientRoles[p.id] || p.role;
        // Only the Host's mic remains strictly independent and protected from others
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

  // TODO: Host control - mute all
  // POST /api/meeting/{meetingId}/mute-all
  muteAll: () => set((state) => {
    const participants = state.participants.map(p => {
      const role = state.transientRoles[p.id] || p.role;
      // Co-hosts are now included in "Mute All", only Host is excluded
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

  // TODO: Host control - change role
  // PUT /api/meeting/{meetingId}/participants/{participantId}/role
  makeHost: (id: string) => {
    // Set transient role overrides so role changes are not persisted across refresh
    set((state) => {
      // Check count of current hosts
      const currentHostCount = state.participants.filter(p => p.role === 'host').length;
      if (currentHostCount >= 2) {
        console.warn('Cannot add host: Maximum 1 additional host allowed (Total 2 hosts).');
        return {};
      }

      const next = { ...state.transientRoles };
      // Allow multiple hosts: DO NOT demote existing transient hosts
      next[id] = ('host' as Participant['role']);

      // Update in-memory participants list
      const participants = state.participants.map(p => {
        if (p.id === id) return { ...p, role: ('host' as Participant['role']) };
        return p;
      });

      const res = { transientRoles: next, participants };
      setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
      return res;
    });
    // We do NOT update meeting.hostId here to the new host, effectively allowing multiple hosts but keeping the original/current "primary" host ID if needed, 
    // OR we can update it. The requirement says "original Host must retain Host privileges". 
    // Usually meeting.hostId tracks the "Owner". Let's leave meeting.hostId as is or only update if it acts as "current presenter".
    // For now, I'll remove the meeting.hostId update to avoid confusion about who is the "primary". 
    // The role 'host' on the participant is what grants privileges.
  },

  makeCoHost: (id: string) => {
    set((state) => {
      // Check maximum 2 co-hosts rule
      const currentCoHostsCheck = state.participants.filter(p => p.role === 'co-host');
      if (currentCoHostsCheck.length >= 2) {
        console.warn('Cannot add co-host: Maximum 2 co-hosts allowed.');
        // We can't easily return an error to the caller here as it is void,
        // but the state update will simply not happen.
        // Ideally UI checks this too.
        return {};
      }

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
    // also revert participant role in-memory to 'participant' unless original was host
    const participants = state.participants.map(p => p.id === id ? { ...p, role: ('participant' as Participant['role']) } : p);
    const res = { transientRoles: next, participants };
    setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
    return res;
  }),
  clearAllTransientRoles: () => set({ transientRoles: {} }),

  // Revoke transient host/co-host roles
  revokeHost: (id: string) => {
    set((state) => {
      const next = { ...state.transientRoles };
      // Simply remove the host role. If they were originally a participant, they become one. 
      // If they were originally a host (in DB), this transient store might not fully handle "stripping" a real DB host, 
      // but assuming 'transientRoles' overlays everything.
      // However, if we want to "Remove Host" role, we should set them to 'participant'.
      // Deleting from transientRoles reverts to base 'role'. If base role is 'participant', great.
      delete next[id];

      // Also explicitly set to participant in memory to be safe if we want to force demotion
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
    // Removed minimum 2 co-hosts rule as per new requirement: "acceptable to have 0, 1, or 2 Co-hosts"

    const next = { ...state.transientRoles };
    if (next[id] === 'co-host') delete next[id];
    // Force to participant
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

  // TODO: Admit from waiting room
  // POST /api/meeting/{meetingId}/waiting-room/{participantId}/admit
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

  // Video Controls Implementation
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
        // Only the Host's video toggle remains independent
        if (role === 'host') return p;
        // When allowing video, we also attempt to turn it back on (isVideoOff: false)
        return { ...p, isVideoAllowed: allowed, isVideoOff: !allowed };
      }
      return p;
    });
    setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
    return { participants };
  }),

  stopVideoAll: () => set((state) => {
    // "Video Off All" -> Disable video and force it OFF for participants and co-hosts
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
    // "Video On All" -> Allow starting and force it ON (isVideoOff: false) for participants and co-hosts
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
        // If host has disallowed video, you can't turn it on
        if (!nextVideoOff && p.isVideoAllowed === false) {
          return p;
        }
        return { ...p, isVideoOff: nextVideoOff };
      }
      return p;
    });
    setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
    return { participants };
  })
}));

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