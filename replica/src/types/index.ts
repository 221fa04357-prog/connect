// Core TypeScript types for the ConnectPro application

export type UserRole = 'host' | 'co-host' | 'participant';

export interface User {
  id: string;
  name: string;
  email: string;
  subscriptionPlan?: 'free' | 'pro' | 'enterprise';
  role?: UserRole;
}

export type ViewMode = 'gallery' | 'speaker';
export type ChatType = 'public' | 'private';

export interface Participant {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isScreenSharing?: boolean; // From participant.ts
  isSpeaking: boolean;
  isPinned: boolean;
  isSpotlighted: boolean;
  joinedAt: Date;
  avatar?: string;
  isVideoAllowed?: boolean; // From index.ts
  socketId?: string; // Socket ID for WebRTC signaling
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
  whiteboardEditAccess?: 'hostOnly' | 'coHost' | 'everyone';
  // From meeting.ts
  recordAutomatically?: boolean;
  muteParticipantsOnEntry?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  hostId: string;
  startTime: Date;
  duration?: number; // minutes
  settings?: MeetingSettings;
  originalHostId?: string;
  isRecording: boolean;
  isScreenSharing: boolean;
  viewMode: ViewMode;
  password?: string;
  isLocked?: boolean; // From meeting.ts
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
  id: string;
  name: string;
  joinedAt: Date;
}
