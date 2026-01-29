export type ViewMode = 'gallery' | 'speaker';

export interface MeetingSettings {
  allowParticipantsToUnmute: boolean;
  allowParticipantsToShareScreen: boolean;
  enableWaitingRoom: boolean;
  recordAutomatically: boolean;
  muteParticipantsOnEntry: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  hostId: string;
  startTime: Date;
  duration?: number; // in minutes
  settings: MeetingSettings;
  isRecording: boolean;
  isLocked: boolean;
}

export interface BreakoutRoom {
  id: string;
  name: string;
  participantIds: string[];
  isOpen: boolean;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  isActive: boolean;
  allowMultipleAnswers: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // participant IDs
}

export interface Reaction {
  id: string;
  participantId: string;
  emoji: string;
  timestamp: Date;
}