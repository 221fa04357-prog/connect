// Zustand store for meeting state management

import { create } from 'zustand';
import { Meeting, ViewMode, Reaction } from '@/types';
import { eventBus } from '@/lib/eventBus';

const INSTANCE_ID = eventBus.instanceId;

interface MeetingState {
  meeting: Meeting | null;
  viewMode: ViewMode;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isWhiteboardOpen: boolean;
  isSettingsOpen: boolean;
  reactions: Reaction[];
  virtualBackground: string | null;
  isBackgroundBlurred: boolean;

  // New State for features
  screenShareStream: MediaStream | null;
  recordingStartTime: number | null;

  // Actions
  setMeeting: (meeting: Meeting) => void;
  extendMeetingTime: (minutes: number) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  toggleRecording: () => void;
  toggleChat: () => void;
  toggleParticipants: () => void;
  toggleWhiteboard: () => void;
  toggleSettings: () => void;

  addReaction: (reaction: Reaction) => void;
  removeReaction: (id: string) => void;      // 🔥 ADDED
  clearReactions: () => void;

  setVirtualBackground: (bg: string | null) => void;
  toggleBackgroundBlur: () => void;
  leaveMeeting: () => void;
  setScreenShareStream: (stream: MediaStream | null) => void;
  setRecordingStartTime: (time: number | null) => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  meeting: {
    id: 'meeting-123',
    title: 'Team Standup',
    hostId: 'participant-1',
    originalHostId: 'participant-1',
    startTime: new Date(),
    duration: 60,
    settings: {
      enableWaitingRoom: true,
      allowParticipantsToUnmute: true,
      allowParticipantsToShareScreen: true,
    },
    isRecording: false,
    isScreenSharing: false,
    viewMode: 'gallery'
  },

  viewMode: 'gallery',
  isAudioMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  isRecording: false,
  isChatOpen: false,
  isParticipantsOpen: false,
  isWhiteboardOpen: false,
  isSettingsOpen: false,

  reactions: [],
  virtualBackground: null,
  isBackgroundBlurred: false,
  screenShareStream: null,
  recordingStartTime: null,

  setMeeting: (meeting) => set({ meeting }),
  setViewMode: (mode) => set({ viewMode: mode }),

  toggleAudio: () =>
    set((state) => ({ isAudioMuted: !state.isAudioMuted })),

  toggleVideo: () =>
    set((state) => ({ isVideoOff: !state.isVideoOff })),

  toggleScreenShare: () =>
    set((state) => ({ isScreenSharing: !state.isScreenSharing })),

  toggleRecording: () =>
    set((state) => ({ isRecording: !state.isRecording })),

  toggleChat: () =>
    set((state) => ({ isChatOpen: !state.isChatOpen })),

  toggleParticipants: () =>
    set((state) => ({ isParticipantsOpen: !state.isParticipantsOpen })),

  toggleWhiteboard: () =>
    set((state) => ({ isWhiteboardOpen: !state.isWhiteboardOpen })),

  toggleSettings: () =>
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  // 🔥 Zoom-style reaction add + auto cleanup support
  addReaction: (reaction) =>
    set((state) => ({
      reactions: [...state.reactions, reaction],
    })),

  // 🔥 REMOVE reaction after animation
  removeReaction: (id) =>
    set((state) => ({
      reactions: state.reactions.filter((r) => r.id !== id),
    })),

  clearReactions: () => set({ reactions: [] }),

  setVirtualBackground: (bg) => set({ virtualBackground: bg }),

  toggleBackgroundBlur: () =>
    set((state) => ({ isBackgroundBlurred: !state.isBackgroundBlurred })),

  leaveMeeting: () => set({ meeting: null }),

  setScreenShareStream: (stream) =>
    set({ screenShareStream: stream }),

  setRecordingStartTime: (time) =>
    set({ recordingStartTime: time }),

  extendMeetingTime: (minutes: number) =>
    set((state) => {
      if (!state.meeting) return {} as any;
      const m = state.meeting;
      const newDuration = (m.duration || 0) + minutes;
      const next = { meeting: { ...m, duration: newDuration } } as any;

      setTimeout(() =>
        eventBus.publish(
          'meeting:update',
          { meeting: useMeetingStore.getState().meeting },
          { source: INSTANCE_ID }
        )
      );

      return next;
    }),
}));

// Subscribe to remote meeting updates
eventBus.subscribe('meeting:update', (payload, meta) => {
  if (meta?.source === INSTANCE_ID) return;
  if (payload && payload.meeting) {
    useMeetingStore.setState({ meeting: payload.meeting });
  }
});

// Subscription helper
export const subscribeToMeeting = (
  listener: (meeting: Meeting | null) => void
) =>
  useMeetingStore.subscribe((state) =>
    listener(state.meeting)
  );
