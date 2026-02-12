// Zustand store for meeting state management

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Meeting, ViewMode, Reaction } from '@/types';
import { eventBus } from '@/lib/eventBus';

const INSTANCE_ID = eventBus.instanceId;

interface MeetingState {
  meeting: Meeting | null;
  viewMode: ViewMode;
  isScreenSharing: boolean;
  isRecording: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isWhiteboardOpen: boolean;
  isSettingsOpen: boolean;
  isAICompanionOpen: boolean;
  showReactions: boolean;
  reactions: Reaction[];
  virtualBackground: string | null;
  isBackgroundBlurred: boolean;
  screenShareStream: MediaStream | null;
  recordingStartTime: number | null;
  localStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;

  setMeeting: (meeting: Meeting) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  extendMeetingTime: (minutes: number) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleScreenShare: () => void;
  toggleRecording: () => void;
  toggleChat: () => void;
  toggleParticipants: () => void;
  toggleWhiteboard: () => void;
  toggleSettings: () => void;
  toggleAICompanion: () => void;
  toggleReactions: () => void;

  addReaction: (reaction: Reaction) => void;
  removeReaction: (id: string) => void;
  clearReactions: () => void;

  setVirtualBackground: (bg: string | null) => void;
  toggleBackgroundBlur: () => void;
  leaveMeeting: () => void;
  setScreenShareStream: (stream: MediaStream | null) => void;
  setRecordingStartTime: (time: number | null) => void;

  showSelfView: boolean;
  toggleSelfView: () => void;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  setConnectionQuality: (quality: 'excellent' | 'good' | 'poor' | 'offline') => void;
}

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set) => ({
      meeting: null,
      viewMode: 'gallery',
      isScreenSharing: false,
      isRecording: false,
      isChatOpen: false,
      isParticipantsOpen: false,
      isWhiteboardOpen: false,
      isSettingsOpen: false,
      isAICompanionOpen: false,
      showReactions: false,
      reactions: [],
      virtualBackground: null,
      isBackgroundBlurred: false,
      screenShareStream: null,
      recordingStartTime: null,
      showSelfView: true,
      localStream: null,
      isAudioMuted: false,
      isVideoOff: false,
      connectionQuality: 'excellent',

      // Actions ...
      setMeeting: (meeting) => set({ meeting }),
      setLocalStream: (stream) => set({ localStream: stream }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleSelfView: () => set((state) => ({ showSelfView: !state.showSelfView })),
      toggleAudio: () => set((state) => ({ isAudioMuted: !state.isAudioMuted })),
      toggleVideo: () => set((state) => ({ isVideoOff: !state.isVideoOff })),
      toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
      toggleRecording: () => set((state) => ({ isRecording: !state.isRecording })),
      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
      toggleParticipants: () => set((state) => ({ isParticipantsOpen: !state.isParticipantsOpen })),
      toggleWhiteboard: () => set((state) => ({ isWhiteboardOpen: !state.isWhiteboardOpen })),
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      toggleAICompanion: () => set((state) => ({ isAICompanionOpen: !state.isAICompanionOpen })),
      toggleReactions: () => set((state) => ({ showReactions: !state.showReactions })),
      addReaction: (reaction) => set((state) => ({ reactions: [...state.reactions, reaction] })),
      removeReaction: (id) => set((state) => ({ reactions: state.reactions.filter((r) => r.id !== id) })),
      clearReactions: () => set({ reactions: [] }),
      setVirtualBackground: (bg) => set({ virtualBackground: bg }),
      toggleBackgroundBlur: () => set((state) => ({ isBackgroundBlurred: !state.isBackgroundBlurred })),
      leaveMeeting: () => set({ meeting: null }),
      setScreenShareStream: (stream) => set({ screenShareStream: stream }),
      setRecordingStartTime: (time) => set({ recordingStartTime: time }),
      setConnectionQuality: (quality) => set({ connectionQuality: quality }),
      extendMeetingTime: (minutes: number) => set((state) => {
        if (!state.meeting) return {} as any;
        const m = state.meeting;
        const newDuration = (m.duration || 0) + minutes;
        const next = { meeting: { ...m, duration: newDuration } } as any;
        setTimeout(() => eventBus.publish('meeting:update', { meeting: useMeetingStore.getState().meeting }, { source: INSTANCE_ID }));
        return next;
      }),
    }),
    {
      name: 'meeting-store',
      storage: createJSONStorage(() => sessionStorage),
      // Don't persist streams as they can't be serialized
      partialize: (state) => {
        const { localStream, screenShareStream, ...rest } = state;
        return rest;
      },
    }
  )
);

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
