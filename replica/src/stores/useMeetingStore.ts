// Zustand store for meeting state management

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Meeting, ViewMode, Reaction } from '@/types';
import { eventBus } from '@/lib/eventBus';
import { useChatStore } from './useChatStore';
import { useAIStore } from './useAIStore';
import { AudioProcessor, ENHANCED_AUDIO_CONSTRAINTS } from '@/lib/audioProcessor';

const audioProcessor = new AudioProcessor();

const INSTANCE_ID = eventBus.instanceId;
const API = import.meta.env.VITE_API_URL || '';

// ─── Strict Video Request Types ───────────────────────────────────────────────
export interface VideoRequestState {
  status: 'idle' | 'pending';
  requesterName: string;
  requesterId: string;
}

export type VideoPermissions = {
  [userId: string]: 'accepted' | 'rejected' | 'pending';
};

const DEFAULT_VIDEO_REQUEST_STATE: VideoRequestState = {
  status: 'idle',
  requesterName: '',
  requesterId: '',
};

export interface PreSuspensionState {
  isAudioMuted: boolean;
  isVideoOff: boolean;
}

export interface RemoteControlState {
  status: 'idle' | 'pending' | 'active';
  role: 'controller' | 'controlled' | null;
  targetId: string | null;
  targetName: string | null;
}

export interface RemoteCursor {
  x: number;
  y: number;
}

const DEFAULT_REMOTE_CONTROL_STATE: RemoteControlState = {
  status: 'idle',
  role: null,
  targetId: null,
  targetName: null,
};
// ──────────────────────────────────────────────────────────────────────────────

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
  rawStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  whiteboardStrokes: any[];
  hasHydrated: boolean;

  recordingPermissionStatus: 'idle' | 'requesting' | 'granted' | 'denied';
  showHostMutePopup: boolean;
  isAnalyticsOpen: boolean;
  isStatsOpen: boolean;

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
  toggleStats: () => void;

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

  pendingMediaRequest: { type: 'audio' | 'video', fromName: string } | null;
  setPendingMediaRequest: (request: { type: 'audio' | 'video', fromName: string } | null) => void;
  remoteControlState: RemoteControlState;
  setRemoteControlState: (state: Partial<RemoteControlState>) => void;

  // ─── Single canonical definition ───
  videoRequestState: VideoRequestState;
  setVideoRequestState: (state: VideoRequestState) => void;

  videoPermissions: VideoPermissions;
  setVideoPermission: (userId: string, status: 'accepted' | 'rejected' | 'pending') => void;

  preSuspensionState: PreSuspensionState | null;
  setPreSuspensionState: (state: PreSuspensionState | null) => void;
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
      isAnalyticsOpen: false,
      isStatsOpen: false,

      showReactions: false,
      reactions: [],

      virtualBackground: null,
      isBackgroundBlurred: false,
      screenShareStream: null,
      recordingStartTime: null,
      showSelfView: true,
      localStream: null,
      rawStream: null,
      isAudioMuted: true,

      showUpgradeModal: false,
      setShowUpgradeModal: (show) => set({ showUpgradeModal: show }),

      isVideoOff: true,
      whiteboardStrokes: [],
      hasHydrated: false,

      recordingPermissionStatus: 'idle',
      showHostMutePopup: false,

      showMicConfirm: false,
      showVideoConfirm: false,

      videoRequestState: { status: 'idle', requesterName: '', requesterId: '' },
      videoPermissions: {},

      preSuspensionState: null,
      setPreSuspensionState: (state) => set({ preSuspensionState: state }),

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

      pendingMediaRequest: null,
      setPendingMediaRequest: (request) => set({ pendingMediaRequest: request }),
      remoteControlState: DEFAULT_REMOTE_CONTROL_STATE,
      setRemoteControlState: (newState) => set((s) => ({
        remoteControlState: { ...s.remoteControlState, ...newState }
      })),

      audioDevices: [],
      videoDevices: [],
      speakerDevices: [],
      selectedAudioId: 'default',
      selectedVideoId: 'default',
      selectedSpeakerId: 'default',

      // ================= ACTIONS =================

      setMeeting: (m) => {
        if (!m) {
          set({ meeting: null, isJoinedAsHost: false });
          return;
        }
        const nextSettings = typeof m.settings === 'string' ? JSON.parse(m.settings) : m.settings;
        set({ meeting: { ...m, settings: nextSettings } });
      },
      setLocalStream: async (stream) => {
        const state = get();
        if (state.localStream === stream) return;
        
        if (state.localStream) {
          state.localStream.getTracks().forEach(track => {
            track.stop();
          });
        }

        if (stream && stream.getAudioTracks().length > 0) {
          // Keep a reference to the original, unprocessed stream!
          set({ rawStream: stream });
          try {
            const processedStream = await audioProcessor.processStream(stream);
            set({ localStream: processedStream });
          } catch (err) {
            console.error('AudioProcessor error:', err);
            set({ localStream: stream });
          }
        } else {
          audioProcessor.stop();
          set({ localStream: stream, rawStream: null });
        }
      },

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
              audio: { 
                ...ENHANCED_AUDIO_CONSTRAINTS,
                deviceId: id !== 'default' ? { exact: id } : undefined 
              }
            });

            const newAudioTrack = newStream.getAudioTracks()[0];
            newAudioTrack.enabled = !nextMuted;

            const combinedStream = new MediaStream([newAudioTrack]);
            if (videoTrack) {
              combinedStream.addTrack(videoTrack);
            }

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
      },

      setViewMode: (mode) => set({ viewMode: mode }),

      toggleSelfView: () =>
        set((state) => ({ showSelfView: !state.showSelfView })),

      setAudioMuted: (muted) =>
        set((state) => {
          if (state.localStream) {
            state.localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
          }
          if (state.rawStream) {
            state.rawStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
          }
          return { isAudioMuted: muted };
        }),

      setVideoOff: (off) =>
        set((state) => {
          if (state.localStream) {
            state.localStream.getVideoTracks().forEach((t) => {
              t.enabled = !off;
              if (off) {
                t.stop();
                state.localStream?.removeTrack(t);
              }
            });
          }
          return { isVideoOff: off };
        }),

      toggleAudio: () =>
        set((state) => {
          const nextMuted = !state.isAudioMuted;
          if (state.localStream) {
            state.localStream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
          }
          if (state.rawStream) {
            state.rawStream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
          }
          return { isAudioMuted: nextMuted };
        }),

      toggleVideo: () =>
        set((state) => {
          const nextVideoOff = !state.isVideoOff;
          if (state.localStream) {
            state.localStream.getVideoTracks().forEach((t) => {
              t.enabled = !nextVideoOff;
              if (nextVideoOff) {
                t.stop();
                state.localStream?.removeTrack(t);
              }
            });
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

      toggleStats: () =>
        set((state) => ({ isStatsOpen: !state.isStatsOpen })),


      setMicConfirm: (show) => set({ showMicConfirm: show }),
      setVideoConfirm: (show) => set({ showVideoConfirm: show }),

      addReaction: (reaction) =>
        set((state) => {
          if (state.reactions.some((r: any) => r.id === reaction.id)) return state;
          return { reactions: [...state.reactions, reaction] };
        }),

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

        if (state.localStream) {
          state.localStream.getTracks().forEach((track) => {
            track.stop();
            console.log(`Stopped ${track.kind} track`);
          });
        }

        if (state.screenShareStream) {
          state.screenShareStream.getTracks().forEach((track) => {
            track.stop();
            console.log(`Stopped screen share ${track.kind} track`);
          });
        }

        useChatStore.getState().reset();
        useAIStore.getState().reset();

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
          videoRequestState: { status: 'idle', requesterName: '', requesterId: '' },
          videoPermissions: {},
        });
      },

      setScreenShareStream: (stream) => set({ screenShareStream: stream }),
      setRecordingStartTime: (time) => set({ recordingStartTime: time }),

      // ─── Strictly typed setters ───
      setVideoRequestState: (state: VideoRequestState) =>
        set({ videoRequestState: state }),

      setVideoPermission: (userId, status) =>
        set((s) => ({
          videoPermissions: { ...s.videoPermissions, [userId]: status }
        })),

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

        set({ meeting: { ...m, settings: nextSettings } });

        // Optimistic broadcast to ensure real-time update even if DB sync has latency/CORS catch
        console.log(`[Whiteboard Access] Optimistically emitting access update: ${access}`);
        useChatStore.getState().emitWhiteboardAccessUpdate(m.id, access);

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
        whiteboardStrokes: [...state.whiteboardStrokes, stroke],
        whiteboardRedoStack: []
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

        const updatedMeeting = {
          ...state.meeting,
          settings: { ...state.meeting.settings, ...settings }
        };
        set({ meeting: updatedMeeting });

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
