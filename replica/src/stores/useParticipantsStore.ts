// Zustand store for participants management

import { create } from 'zustand';
import { Participant, WaitingRoomParticipant } from '@/types';
import { generateMockParticipants, generateWaitingRoomParticipants } from '@/utils/mockData';

interface ParticipantsState {
  participants: Participant[];
  waitingRoom: WaitingRoomParticipant[];
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
  admitFromWaitingRoom: (id: string) => void;
  removeFromWaitingRoom: (id: string) => void;
}

// TODO: Connect to backend WebSocket for real-time participant updates
// WebSocket endpoint: ws://api.example.com/meeting/{meetingId}/participants

export const useParticipantsStore = create<ParticipantsState>((set) => ({
  participants: generateMockParticipants(8),
  waitingRoom: generateWaitingRoomParticipants(),
  activeSpeakerId: null,
  pinnedParticipantId: null,
  spotlightedParticipantId: null,

  setParticipants: (participants) => set({ participants }),

  // TODO: Broadcast via WebSocket
  // WS message: { type: 'participant_joined', data: participant }
  addParticipant: (participant) => set((state) => ({
    participants: [...state.participants, participant]
  })),

  // TODO: Broadcast via WebSocket
  // WS message: { type: 'participant_left', data: { participantId } }
  removeParticipant: (id) => set((state) => ({
    participants: state.participants.filter(p => p.id !== id)
  })),

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
  makeHost: (id) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === id ? { ...p, role: 'host' } : { ...p, role: p.role === 'host' ? 'participant' : p.role }
    )
  })),

  makeCoHost: (id) => set((state) => ({
    participants: state.participants.map(p =>
      p.id === id ? { ...p, role: 'co-host' } : p
    )
  })),

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

    return {
      participants: [...state.participants, newParticipant],
      waitingRoom: state.waitingRoom.filter(p => p.id !== id)
    };
  }),

  removeFromWaitingRoom: (id) => set((state) => ({
    waitingRoom: state.waitingRoom.filter(p => p.id !== id)
  }))
}));