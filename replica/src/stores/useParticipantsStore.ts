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
}

// TODO: Connect to backend WebSocket for real-time participant updates
// WebSocket endpoint: ws://api.example.com/meeting/{meetingId}/participants

export const useParticipantsStore = create<ParticipantsState>((set) => ({
  participants: generateMockParticipants(8),
  waitingRoom: generateWaitingRoomParticipants(),
  transientRoles: {},
  waitingRoomEnabled: true,
  activeSpeakerId: null,
  pinnedParticipantId: null,
  spotlightedParticipantId: null,

  setParticipants: (participants) => set({ participants }),

  // TODO: Broadcast via WebSocket
  // WS message: { type: 'participant_joined', data: participant }
  addParticipant: (participant) => set((state) => {
    // If waiting room feature is enabled, route new non-host participants to waitingRoom
    if (state.waitingRoomEnabled && participant.role === 'participant') {
      const waitingEntry: WaitingRoomParticipant = { id: participant.id, name: participant.name, joinedAt: new Date() };
      return { waitingRoom: [...state.waitingRoom, waitingEntry] };
    }
    const res = { participants: [...state.participants, participant] };
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

  updateParticipant: (id, updates) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === id ? { ...p, ...updates } : p
    )
  })),

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
  muteParticipant: (id: string) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === id ? { ...p, isAudioMuted: true } : p
    )
  })),

  unmuteParticipant: (id) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === id ? { ...p, isAudioMuted: false } : p
    )
  })),

  // TODO: Host control - mute all
  // POST /api/meeting/{meetingId}/mute-all
  muteAll: () => set((state) => ({
    participants: state.participants.map(p => ({ ...p, isAudioMuted: true }))
  })),

  unmuteAll: () => set((state) => ({
    participants: state.participants.map(p => ({ ...p, isAudioMuted: false }))
  })),

  // TODO: Host control - change role
  // PUT /api/meeting/{meetingId}/participants/{participantId}/role
  makeHost: (id: string) => {
    // Set transient role overrides so role changes are not persisted across refresh
    set((state) => {
      const next = { ...state.transientRoles };
      // demote any existing transient host to participant
      Object.keys(next).forEach(k => {
        if (next[k] === ('host' as Participant['role'])) next[k] = ('participant' as Participant['role']);
      });
      next[id] = ('host' as Participant['role']);
      // also update in-memory participants list so UI reading participant.role updates
      const participants = state.participants.map(p => {
        if (p.id === id) return { ...p, role: ('host' as Participant['role']) };
        if (p.role === ('host' as Participant['role'])) return { ...p, role: ('participant' as Participant['role']) };
        return p;
      });
      const res = { transientRoles: next, participants };
      setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
      return res;
    });
    // Also update meeting hostId temporarily
    const meeting = useMeetingStore.getState().meeting;
    if (meeting) {
      useMeetingStore.getState().setMeeting({ ...meeting, hostId: id });
    }
  },

  makeCoHost: (id: string) => {
    set((state) => {
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
      delete next[id];
      // revert participant roles
      const participants = state.participants.map(p => ({ ...p, role: p.role === ('host' as Participant['role']) && p.id === id ? ('participant' as Participant['role']) : p.role }));
      const res = { transientRoles: next, participants };
      setTimeout(() => eventBus.publish('participants:update', { participants: useParticipantsStore.getState().participants, transientRoles: useParticipantsStore.getState().transientRoles }, { source: INSTANCE_ID }));
      return res;
    });
    const meeting = useMeetingStore.getState().meeting;
    if (meeting?.originalHostId) {
      useMeetingStore.getState().setMeeting({ ...meeting, hostId: meeting.originalHostId });
    }
  },
  revokeCoHost: (id: string) => set((state) => {
    const next = { ...state.transientRoles };
    if (next[id] === 'co-host') delete next[id];
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
  })
}));

// Subscribe to incoming participant updates from eventBus (ignore self-originated events)
eventBus.subscribe('participants:update', (payload, meta) => {
  if (meta?.source === INSTANCE_ID) return; // ignore our own events
  if (payload && payload.participants) {
    useParticipantsStore.setState({ participants: payload.participants, transientRoles: payload.transientRoles || {} });
  }
});

// Subscription helper
export const subscribeToParticipants = (listener: (participants: Participant[]) => void) =>
  useParticipantsStore.subscribe((state) => listener(state.participants));