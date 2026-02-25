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

  recordingPermissionStatus: 'idle' | 'requesting' | 'granted' | 'denied';
  showHostMutePopup: boolean;
  isAnalyticsOpen: boolean;
  showCaptions: boolean;

  // ✅ Confirmation Modals (from main branch)
  showMicConfirm: boolean;
  showVideoConfirm: boolean;
  setRecordingPermissionStatus: (status: 'idle' | 'requesting' | 'granted' | 'denied') => void;
  setShowHostMutePopup: (show: boolean) => void;

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
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  speakerDevices: MediaDeviceInfo[];
  selectedAudioId: string;
  selectedVideoId: string;
  selectedSpeakerId: string;

  // ===== Actions =====
  setMeeting: (meeting: Meeting) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  enumerateDevices: () => Promise<void>;
  setAudioDevice: (id: string) => Promise<void>;
  setVideoDevice: (id: string) => Promise<void>;
  setSpeakerDevice: (id: string) => void;
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
  setWhiteboardOpen: (open: boolean) => void;
  toggleSettings: () => void;
  toggleAICompanion: () => void;
  toggleReactions: () => void;
  toggleAnalytics: () => void;
  toggleCaptions: () => void;

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
  appendWhiteboardPoints: (id: string, newPoints: [number, number][]) => void;
  removeWhiteboardStroke: (id: string) => void;
  clearWhiteboardStrokes: () => void;
  setWhiteboardStrokes: (strokes: any[]) => void;
  undoWhiteboardStroke: () => void;
  redoWhiteboardStroke: () => void;
  whiteboardRedoStack: any[];
  whiteboardInitiatorId: string | null;
  setWhiteboardInitiatorId: (id: string | null) => void;

  showSelfView: boolean;
  toggleSelfView: () => void;

  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;

  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  setConnectionQuality: (
    quality: 'excellent' | 'good' | 'poor' | 'offline'
  ) => void;
  checkParticipantStatus: (meetingId: string, userId: string) => Promise<'admitted' | 'waiting' | 'rejected' | 'not_found' | 'error'>;
  updateMeetingSettings: (settings: Partial<any>) => void;
}


export const useMeetingStore = create<MeetingState>()(
  persist(
    (set, get) => ({
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

      showUpgradeModal: false,
      setShowUpgradeModal: (show) => set({ showUpgradeModal: show }),

      isVideoOff: false,
      whiteboardStrokes: [],
      hasHydrated: false,

      recordingPermissionStatus: 'idle',
      showHostMutePopup: false,
      isAnalyticsOpen: false,
      showCaptions: false,

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
      whiteboardInitiatorId: null,
      setWhiteboardInitiatorId: (id) => set({ whiteboardInitiatorId: id }),
      whiteboardRedoStack: [],

      connectionQuality: 'excellent',

      audioDevices: [],
      videoDevices: [],
      speakerDevices: [],
      selectedAudioId: 'default',
      selectedVideoId: 'default',
      selectedSpeakerId: 'default',

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

      enumerateDevices: async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          set({
            audioDevices: devices.filter(d => d.kind === 'audioinput'),
            videoDevices: devices.filter(d => d.kind === 'videoinput'),
            speakerDevices: devices.filter(d => d.kind === 'audiooutput')
          });
        } catch (err) {
          console.error('Error enumerating devices:', err);
        }
      },

      setAudioDevice: async (id) => {
        set({ selectedAudioId: id });
        const state = get();
        if (state.localStream) {
          try {
            const videoTrack = state.localStream.getVideoTracks()[0];
            const nextMuted = state.isAudioMuted;

            const newStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: id !== 'default' ? { exact: id } : undefined }
            });

            const newAudioTrack = newStream.getAudioTracks()[0];
            newAudioTrack.enabled = !nextMuted;

            const combinedStream = new MediaStream([newAudioTrack]);
            if (videoTrack) {
              combinedStream.addTrack(videoTrack);
            }

            // setLocalStream handles stopping old tracks
            get().setLocalStream(combinedStream);
          } catch (err) {
            console.error('Error switching audio device:', err);
          }
        }
      },

      setVideoDevice: async (id) => {
        set({ selectedVideoId: id });
        const state = get();
        if (state.localStream) {
          try {
            const audioTrack = state.localStream.getAudioTracks()[0];
            const nextVideoOff = state.isVideoOff;

            const newStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: id !== 'default' ? { exact: id } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                aspectRatio: { ideal: 16 / 9 }
              }
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            newVideoTrack.enabled = !nextVideoOff;

            const combinedStream = new MediaStream([newVideoTrack]);
            if (audioTrack) {
              combinedStream.addTrack(audioTrack);
            }

            get().setLocalStream(combinedStream);
          } catch (err) {
            console.error('Error switching video device:', err);
          }
        }
      },

      setSpeakerDevice: (id) => {
        set({ selectedSpeakerId: id });
        // Setting audio output device (speaker) requires sinkId on HTMLMediaElement
        // This is typically handled in the components rendering video/audio elements.
      },

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

      setWhiteboardOpen: (open) => set({ isWhiteboardOpen: open }),

      toggleSettings: () =>
        set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

      toggleAICompanion: () =>
        set((state) => ({ isAICompanionOpen: !state.isAICompanionOpen })),

      toggleReactions: () =>
        set((state) => ({ showReactions: !state.showReactions })),
      toggleAnalytics: () =>
        set((state) => ({ isAnalyticsOpen: !state.isAnalyticsOpen })),
      toggleCaptions: () =>
        set((state) => ({ showCaptions: !state.showCaptions })),

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
          whiteboardInitiatorId: null,
          recordingPermissionStatus: 'idle',
          showHostMutePopup: false,
        });
      },

      setScreenShareStream: (stream) =>
        set({ screenShareStream: stream }),

      setRecordingStartTime: (time) =>
        set({ recordingStartTime: time }),

      setRecordingPermissionStatus: (status) =>
        set({ recordingPermissionStatus: status }),

      setShowHostMutePopup: (show) =>
        set({ showHostMutePopup: show }),

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

        // Optimistic update
        set({ meeting: { ...m, settings: nextSettings } });

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

          // Emit to other clients
          useChatStore.getState().emitWhiteboardAccessUpdate(m.id, access);
        } catch (err) {
          console.error('Error setting whiteboard access:', err);
        }
      },
      addWhiteboardStroke: (stroke) => set((state) => ({
        whiteboardStrokes: [...state.whiteboardStrokes, stroke],
        whiteboardRedoStack: [] // Clear redo history when drawing something new
      })),
      updateWhiteboardStroke: (id, points) => set((state) => ({
        whiteboardStrokes: state.whiteboardStrokes.map(s => s.id === id ? { ...s, points } : s)
      })),
      appendWhiteboardPoints: (id, newPoints) => set((state) => ({
        whiteboardStrokes: state.whiteboardStrokes.map(s => s.id === id ? { ...s, points: [...(s.points || []), ...newPoints] } : s)
      })),
      removeWhiteboardStroke: (id) => set((state) => ({
        whiteboardStrokes: state.whiteboardStrokes.filter(s => s.id !== id)
      })),
      clearWhiteboardStrokes: () => set({ whiteboardStrokes: [], whiteboardRedoStack: [] }),
      setWhiteboardStrokes: (strokes) => set({ whiteboardStrokes: strokes }),
      undoWhiteboardStroke: () => set((state) => {
        if (state.whiteboardStrokes.length === 0) return state;
        const lastStroke = state.whiteboardStrokes[state.whiteboardStrokes.length - 1];
        return {
          whiteboardStrokes: state.whiteboardStrokes.slice(0, -1),
          whiteboardRedoStack: [...state.whiteboardRedoStack, lastStroke]
        };
      }),
      redoWhiteboardStroke: () => set((state) => {
        if (state.whiteboardRedoStack.length === 0) return state;
        const lastUndoneStroke = state.whiteboardRedoStack[state.whiteboardRedoStack.length - 1];
        return {
          whiteboardRedoStack: state.whiteboardRedoStack.slice(0, -1),
          whiteboardStrokes: [...state.whiteboardStrokes, lastUndoneStroke]
        };
      }),
      checkParticipantStatus: async (meetingId, userId) => {
        try {
          const response = await fetch(`${API}/api/meetings/${meetingId}/participant-status`, {
            headers: { 'x-user-id': userId }
          });
          if (!response.ok) throw new Error('Failed to fetch status');
          const data = await response.json();
          const status = data.status;

          if (status === 'admitted') {
            set({
              isWaiting: false,
              isAudioMuted: data.micOn !== undefined ? !data.micOn : get().isAudioMuted,
              isVideoOff: data.cameraOn !== undefined ? !data.cameraOn : get().isVideoOff
            });
          } else if (status === 'waiting') {
            set({ isWaiting: true });
          } else if (status === 'rejected') {
            // Handled by component if needed
          }
          return status;
        } catch (err) {
          console.error('Error checking participant status:', err);
          return 'error';
        }
      },
      updateMeetingSettings: (settings) => {
        const state = get();
        if (!state.meeting) return;

        // Optimistically update local state
        const updatedMeeting = {
          ...state.meeting,
          settings: { ...state.meeting.settings, ...settings }
        };
        set({ meeting: updatedMeeting });

        // Emit to socket
        useChatStore.getState().updateMeetingSettings(state.meeting.id, settings);
      },
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
