// Mock data generators for the ConnectPro application

import { Participant, ChatMessage, Poll, BreakoutRoom, WaitingRoomParticipant } from '@/types';

const names = [
  'Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown',
  'Emma Davis', 'Frank Miller', 'Grace Wilson', 'Henry Moore',
  'Ivy Taylor', 'Jack Anderson', 'Kate Thomas', 'Liam Jackson'
];

const avatarColors = [
  '#0B5CFF', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
];

export const generateMockParticipants = (count: number = 8): Participant[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `participant-${i + 1}`,
    name: names[i] || `Participant ${i + 1}`,
    role: i === 0 ? 'host' : i === 1 ? 'co-host' : 'participant',
    isAudioMuted: Math.random() > 0.5,
    isVideoOff: Math.random() > 0.7,
    isHandRaised: false,
    isSpeaking: false,
    isPinned: false,
    isSpotlighted: false,
    avatar: avatarColors[i % avatarColors.length],
    joinedAt: new Date(Date.now() - Math.random() * 3600000)
  }));
};

export const generateMockMessages = (count: number = 10): ChatMessage[] => {
  const messages = [
    'Hello everyone!',
    'Can you hear me?',
    'Great presentation!',
    'I have a question',
    'Thanks for sharing',
    'Could you repeat that?',
    'Agreed!',
    'Let me share my screen',
    'I\'ll send the link in chat',
    'See you next time!'
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `message-${i + 1}`,
    senderId: `participant-${(i % 8) + 1}`,
    senderName: names[i % names.length],
    content: messages[i % messages.length],
    timestamp: new Date(Date.now() - (count - i) * 60000),
    type: 'public' as const,
    reactions: i % 3 === 0 ? [
      { emoji: '👍', users: [`participant-${((i + 1) % 8) + 1}`, `participant-${((i + 2) % 8) + 1}`] },
      { emoji: '❤️', users: [`participant-${((i + 3) % 8) + 1}`] }
    ] : i % 5 === 0 ? [
      { emoji: '😂', users: [`participant-${((i + 1) % 8) + 1}`] }
    ] : undefined
  }));
};

export const generateMockPoll = (): Poll => ({
  id: 'poll-1',
  question: 'What time works best for our next meeting?',
  options: [
    { id: 'opt-1', text: '9:00 AM', votes: 3 },
    { id: 'opt-2', text: '2:00 PM', votes: 5 },
    { id: 'opt-3', text: '4:00 PM', votes: 2 }
  ],
  createdBy: 'participant-1',
  isActive: true
});

export const generateMockBreakoutRooms = (): BreakoutRoom[] => [
  { id: 'room-1', name: 'Room 1', participantIds: ['participant-2', 'participant-3'], capacity: 4 },
  { id: 'room-2', name: 'Room 2', participantIds: ['participant-4', 'participant-5'], capacity: 4 },
  { id: 'room-3', name: 'Room 3', participantIds: ['participant-6', 'participant-7'], capacity: 4 }
];

export const generateWaitingRoomParticipants = (): WaitingRoomParticipant[] =>
  Array.from({ length: 10 }, (_, i) => ({
    id: `waiting-${i + 1}`,
    name: `New Participant ${i + 1}`,
    joinedAt: new Date(Date.now() - i * 15000)
  }));