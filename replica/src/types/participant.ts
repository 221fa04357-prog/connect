export type ParticipantRole = 'host' | 'co-host' | 'participant';

export interface Participant {
  id: string;
  name: string;
  email?: string;
  role: ParticipantRole;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  isPinned: boolean;
  isSpotlighted: boolean;
  joinedAt: Date;
  avatar?: string;
}