// Zustand store for meeting state management

import { create } from 'zustand';
import { Meeting, ViewMode, Reaction } from '@/types';

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
  clearReactions: () => void;
  setVirtualBackground: (bg: string | null) => void;
  toggleBackgroundBlur: () => void;
  leaveMeeting: () => void;
  setScreenShareStream: (stream: MediaStream | null) => void;
  setRecordingStartTime: (time: number | null) => void;
}

// TODO: Connect to backend WebSocket for real-time meeting state updates
// WebSocket endpoint: ws://api.example.com/meeting/{meetingId}

export const useMeetingStore = create<MeetingState>((set) => ({
  meeting: {
    id: 'meeting-123',
    title: 'Team Standup',
    hostId: '1',
    startTime: new Date(),
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

  // TODO: Connect to backend API
  // PUT /api/meeting/{meetingId}/audio
  toggleAudio: () => set((state) => ({ isAudioMuted: !state.isAudioMuted })),

  // TODO: Connect to backend API
  // PUT /api/meeting/{meetingId}/video
  toggleVideo: () => set((state) => ({ isVideoOff: !state.isVideoOff })),

  // TODO: Connect to backend WebRTC signaling
  // POST /api/meeting/{meetingId}/screen-share
  toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),

  // TODO: Connect to recording service
  // POST /api/meeting/{meetingId}/recording/start
  // POST /api/meeting/{meetingId}/recording/stop
  toggleRecording: () => set((state) => ({ isRecording: !state.isRecording })),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  toggleParticipants: () => set((state) => ({ isParticipantsOpen: !state.isParticipantsOpen })),
  toggleWhiteboard: () => set((state) => ({ isWhiteboardOpen: !state.isWhiteboardOpen })),
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  // TODO: Broadcast reaction via WebSocket
  // WS message: { type: 'reaction', data: { emoji, participantId } }
  addReaction: (reaction) => set((state) => ({
    reactions: [...state.reactions, reaction]
  })),

  clearReactions: () => set({ reactions: [] }),
  setVirtualBackground: (bg) => set({ virtualBackground: bg }),
  toggleBackgroundBlur: () => set((state) => ({ isBackgroundBlurred: !state.isBackgroundBlurred })),

  // TODO: Call backend to end meeting
  // POST /api/meeting/{meetingId}/leave
  // TODO: Call backend to end meeting
  // POST /api/meeting/{meetingId}/leave
  leaveMeeting: () => set({ meeting: null }),

  setScreenShareStream: (stream) => set({ screenShareStream: stream }),
  setRecordingStartTime: (time) => set({ recordingStartTime: time })
}));