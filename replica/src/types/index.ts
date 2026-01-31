// Core TypeScript types for the ConnectPro application

export type UserRole = 'host' | 'co-host' | 'participant';
export type ViewMode = 'gallery' | 'speaker';
export type ChatType = 'public' | 'private';

export interface Participant {
  id: string;
  name: string;
  role: UserRole;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  isPinned: boolean;
  isSpotlighted: boolean;
  avatar?: string;
  joinedAt: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: ChatType;
  recipientId?: string; // For private messages
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  emoji: string;
  users: string[];
}

export interface Meeting {
  id: string;
  title: string;
  hostId: string;
  startTime: Date;
  // Optional extended fields
  duration?: number; // minutes
  settings?: {
    enableWaitingRoom?: boolean;
    allowParticipantsToUnmute?: boolean;
    allowParticipantsToShareScreen?: boolean;
  };
  originalHostId?: string;
  isRecording: boolean;
  isScreenSharing: boolean;
  viewMode: ViewMode;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  isActive: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface BreakoutRoom {
  id: string;
  name: string;
  participantIds: string[];
  capacity: number;
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