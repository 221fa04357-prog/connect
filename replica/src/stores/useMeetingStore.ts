// Zustand store for meeting state management

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Meeting, ViewMode, Reaction } from '@/types';
import { eventBus } from '@/lib/eventBus';
import { useChatStore } from './useChatStore';
import { useAIStore } from './useAIStore';

const INSTANCE_ID = eventBus.instanceId;
const API = import.meta.env.VITE_API_URL || '';

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
  whiteboardStrokes: any[];
  hasHydrated: boolean;

  // ✅ Confirmation Modals (from main branch)
  showMicConfirm: boolean;
  showVideoConfirm: boolean;

  isMiniVisible: boolean;
  meetingJoined: boolean;
  isInsideMeeting: boolean;
  isJoinedAsHost: boolean;
  isWaiting: boolean;
  setMiniVisible: (visible: boolean) => void;
  setMeetingJoined: (joined: boolean) => void;
  setIsInsideMeeting: (inside: boolean) => void;
  setIsJoinedAsHost: (isHost: boolean) => void;
  setIsWaiting: (isWaiting: boolean) => void;

  // ===== Actions =====
  setMeeting: (meeting: Meeting) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  setAudioMuted: (muted: boolean) => void;
  setVideoOff: (off: boolean) => void;
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

  setMicConfirm: (val: boolean) => void;
  setVideoConfirm: (show: boolean) => void;

  addReaction: (reaction: Reaction) => void;
  removeReaction: (id: string) => void;
  clearReactions: () => void;

  setVirtualBackground: (bg: string | null) => void;
  toggleBackgroundBlur: () => void;
  leaveMeeting: () => void;
  setScreenShareStream: (stream: MediaStream | null) => void;
  setRecordingStartTime: (time: number | null) => void;
  setWhiteboardEditAccess: (
    access: 'hostOnly' | 'coHost' | 'everyone'
  ) => void;
  addWhiteboardStroke: (stroke: any) => void;
  updateWhiteboardStroke: (id: string, points: [number, number][]) => void;
  clearWhiteboardStrokes: () => void;
  setWhiteboardStrokes: (strokes: any[]) => void;

  showSelfView: boolean;
  toggleSelfView: () => void;

  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  setConnectionQuality: (
    quality: 'excellent' | 'good' | 'poor' | 'offline'
  ) => void;
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
      whiteboardStrokes: [],
      hasHydrated: false,

      showMicConfirm: false,
      showVideoConfirm: false,

      isMiniVisible: false,
      meetingJoined: false,
      isInsideMeeting: false,
      isJoinedAsHost: false,
      isWaiting: false,
      setMiniVisible: (visible) => set({ isMiniVisible: visible }),
      setMeetingJoined: (joined) => set({ meetingJoined: joined }),
      setIsInsideMeeting: (inside) => set({ isInsideMeeting: inside }),
      setIsJoinedAsHost: (isHost) => set({ isJoinedAsHost: isHost }),
      setIsWaiting: (isWaiting) => set({ isWaiting }),

      connectionQuality: 'excellent',

      // ================= ACTIONS =================

      setMeeting: (meeting) => set({ meeting }),
      setLocalStream: (stream) => set((state) => {
        // Automatically stop old tracks when a new stream is set
        if (state.localStream && state.localStream !== stream) {
          state.localStream.getTracks().forEach(track => {
            track.stop();
            console.log(`MeetingStore: Stopped old track: ${track.kind}`);
          });
        }
        return { localStream: stream };
      }),
      setViewMode: (mode) => set({ viewMode: mode }),

      toggleSelfView: () =>
        set((state) => ({ showSelfView: !state.showSelfView })),

      setAudioMuted: (muted) =>
        set((state) => {
          if (state.localStream) {
            state.localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
          }
          return { isAudioMuted: muted };
        }),

      setVideoOff: (off) =>
        set((state) => {
          if (state.localStream) {
            state.localStream.getVideoTracks().forEach((t) => (t.enabled = !off));
          }
          return { isVideoOff: off };
        }),

      toggleAudio: () =>
        set((state) => {
          const nextMuted = !state.isAudioMuted;
          if (state.localStream) {
            state.localStream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
          }
          return { isAudioMuted: nextMuted };
        }),

      toggleVideo: () =>
        set((state) => {
          const nextVideoOff = !state.isVideoOff;
          if (state.localStream) {
            state.localStream.getVideoTracks().forEach((t) => (t.enabled = !nextVideoOff));
          }
          return { isVideoOff: nextVideoOff };
        }),

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

      toggleAICompanion: () =>
        set((state) => ({ isAICompanionOpen: !state.isAICompanionOpen })),

      toggleReactions: () =>
        set((state) => ({ showReactions: !state.showReactions })),

      setMicConfirm: (show) => set({ showMicConfirm: show }),
      setVideoConfirm: (show) => set({ showVideoConfirm: show }),

      addReaction: (reaction) =>
        set((state) => ({
          reactions: [...state.reactions, reaction],
        })),

      removeReaction: (id) =>
        set((state) => ({
          reactions: state.reactions.filter((r) => r.id !== id),
        })),

      clearReactions: () => set({ reactions: [] }),

      setVirtualBackground: (bg) => set({ virtualBackground: bg }),

      toggleBackgroundBlur: () =>
        set((state) => ({ isBackgroundBlurred: !state.isBackgroundBlurred })),

      leaveMeeting: () => {
        const state = useMeetingStore.getState();

        // Stop all local media tracks FIRST
        if (state.localStream) {
          state.localStream.getTracks().forEach((track) => {
            track.stop();
            console.log(`Stopped ${track.kind} track`);
          });
        }

        // Stop screen share if active
        if (state.screenShareStream) {
          state.screenShareStream.getTracks().forEach((track) => {
            track.stop();
            console.log(`Stopped screen share ${track.kind} track`);
          });
        }

        // Reset Chat Store (disconnects socket)
        useChatStore.getState().reset();

        // Reset AI Store (clear summaries, etc.)
        useAIStore.getState().reset();

        // Reset all meeting state
        set({
          meeting: null,
          localStream: null,
          screenShareStream: null,
          isScreenSharing: false,
          isRecording: false,
          recordingStartTime: null,
          meetingJoined: false,
          isInsideMeeting: false,
          isMiniVisible: false,
          whiteboardStrokes: [],
        });
      },

      setScreenShareStream: (stream) =>
        set({ screenShareStream: stream }),

      setRecordingStartTime: (time) =>
        set({ recordingStartTime: time }),

      setConnectionQuality: (quality) =>
        set({ connectionQuality: quality }),

      extendMeetingTime: async (minutes: number) => {
        const state = useMeetingStore.getState();
        if (!state.meeting) return;

        const m = state.meeting;
        const newDuration = (m.duration || 0) + minutes;

        try {
          const response = await fetch(`${API}/api/meetings/${m.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration: newDuration }),
          });

          if (!response.ok) throw new Error('Failed to update meeting duration');

          const updatedMeetingData = await response.json();
          const nextMeeting = {
            ...m,
            duration: updatedMeetingData.duration,
          };

          set({ meeting: nextMeeting });

          eventBus.publish(
            'meeting:update',
            { meeting: nextMeeting },
            { source: INSTANCE_ID }
          );
        } catch (err) {
          console.error('Error extending meeting time:', err);
        }
      },

      setWhiteboardEditAccess: async (access) => {
        const state = useMeetingStore.getState();
        if (!state.meeting) return;

        const m = state.meeting;
        const nextSettings = {
          ...m.settings,
          whiteboardEditAccess: access,
        };

        try {
          const response = await fetch(`${API}/api/meetings/${m.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: nextSettings }),
          });

          if (!response.ok) throw new Error('Failed to update whiteboard access');

          const updatedMeetingData = await response.json();
          const nextMeeting = {
            ...m,
            settings: updatedMeetingData.settings,
          };

          set({ meeting: nextMeeting });

          eventBus.publish(
            'meeting:update',
            { meeting: nextMeeting },
            { source: INSTANCE_ID }
          );
        } catch (err) {
          console.error('Error setting whiteboard access:', err);
        }
      },
      addWhiteboardStroke: (stroke) => set((state) => ({
        whiteboardStrokes: [...state.whiteboardStrokes, stroke]
      })),
      updateWhiteboardStroke: (id, points) => set((state) => ({
        whiteboardStrokes: state.whiteboardStrokes.map(s => s.id === id ? { ...s, points } : s)
      })),
      clearWhiteboardStrokes: () => set({ whiteboardStrokes: [] }),
      setWhiteboardStrokes: (strokes) => set({ whiteboardStrokes: strokes }),
    }),
    {
      name: 'meeting-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        const { localStream, screenShareStream, ...rest } = state;
        return rest;
      },
      onRehydrateStorage: () => (state, error) => {
        if (state && state.meeting) {
          if (state.meeting.start_timestamp) {
            state.meeting.startTime = new Date(Number(state.meeting.start_timestamp));
          } else if (state.meeting.startTime) {
            const st = state.meeting.startTime as any;
            state.meeting.startTime = new Date(typeof st === 'string' && !st.endsWith('Z') && !st.includes('+') ? (st.includes(' ') ? st.replace(' ', 'T') + 'Z' : st + 'Z') : st);
          }
        }

        if (error) {
          console.error('An error happened during hydration', error);
        } else {
          console.log('MeetingStore hydration finished');
        }

        // Fix: Wrap in setTimeout to avoid "Cannot access 'useMeetingStore' before initialization"
        // if hydration happens synchronously (e.g. sessionStorage)
        setTimeout(() => {
          useMeetingStore.setState({ hasHydrated: true });
        }, 0);
      }
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
