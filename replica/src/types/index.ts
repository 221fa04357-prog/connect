// Core TypeScript types for the NeuralChat application

export type UserRole = 'host' | 'co-host' | 'participant';

export interface User {
  id: string;
  name: string;
  email: string;
  subscriptionPlan?: 'free' | 'pro' | 'enterprise';
  subscription_plan?: 'free' | 'pro' | 'enterprise';
  role?: UserRole;
  isLoggedOut?: boolean;
  avatar?: string;
  lastActive?: number;
}

export type ViewMode = 'gallery' | 'speaker' | 'multi-speaker' | 'immersive';
export type ChatType = 'public' | 'private';

export interface Participant {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  handRaiseNumber?: number;
  handRaiseTimestamp?: number;
  isScreenSharing?: boolean;
  screenShareStreamId?: string;
  isSpeaking: boolean;
  isPinned: boolean;
  isSpotlighted: boolean;
  joinedAt: Date;
  avatar?: string;
  isVideoAllowed?: boolean; // From index.ts
  socketId?: string; // Socket ID for WebRTC signaling
  hasAgent?: boolean; // Track if participant has the native agent running
  agentConnected?: boolean; // Real-time connection status
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: ChatType; // Compatible with 'public' | 'private'
  recipientId?: string; // For private messages
  recipientName?: string; // From chat.ts
  isRead?: boolean; // From chat.ts
  reactions?: MessageReaction[]; // From index.ts
  isPinned?: boolean;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  isDeletedEveryone?: boolean;
  deletedFor?: string[]; // Array of user IDs who deleted this message for themselves
}

export interface MessageReaction {
  emoji: string;
  users: string[];
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  timestamp: Date;
}

export interface MeetingSettings {
  enableWaitingRoom?: boolean;
  allowParticipantsToUnmute?: boolean;
  allowParticipantsToShareScreen?: boolean;
  disableParticipantVideo?: boolean;
  micAllowed?: boolean;
  cameraAllowed?: boolean;
  screenShareAllowed?: boolean;
  chatAllowed?: boolean;
  whiteboardEditAccess?: 'hostOnly' | 'coHost' | 'everyone';
  // From meeting.ts
  recordAutomatically?: boolean;
  muteParticipantsOnEntry?: boolean;
  recordingAllowedForAll?: boolean;
  isLocked?: boolean;
  captionsAllowed?: boolean;
  captionLanguageLocked?: boolean;
  // View mode preferences
  hideParticipantsWithoutVideo?: boolean;
  hideSelfView?: boolean;
  followHostVideoOrder?: boolean;
  // Participant capabilities
  allowRename?: boolean;
  allowDocumentShare?: boolean;
  allowMultipleScreenShares?: boolean;
  suspendParticipantActivities?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  hostId: string;
  startTime: Date;
  start_timestamp?: number | string;
  duration?: number; // minutes
  settings?: MeetingSettings;
  originalHostId?: string;
  isRecording: boolean;
  isScreenSharing: boolean;
  viewMode: ViewMode;
  password?: string;
  isLocked?: boolean; // From meeting.ts
  endTime?: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number; // Consolidating to number as per mockData usage
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  isActive: boolean;
  allowMultipleAnswers?: boolean; // From meeting.ts
  createdAt?: Date; // From meeting.ts
}

export interface BreakoutRoom {
  id: string;
  name: string;
  participantIds: string[];
  capacity?: number; // From index.ts
  isOpen?: boolean; // From meeting.ts
}

export interface Reaction {
  id: string;
  participantId: string;
  emoji: string;
  timestamp: Date;
}

export interface WaitingRoomParticipant {
  id: string; // userId
  socketId: string; // Real socket connection ID
  name: string;
  joinedAt: Date;
}
