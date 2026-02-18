
// Constants
export const REACTIONS = ['👍', '👏', '❤️', '😂', '😮', '🎉', '👎', '🤔'];

export const VIRTUAL_BACKGROUNDS = [
    {
        id: 'none',
        name: 'None',
        thumbnail: null,
    },
    {
        id: 'blur',
        name: 'Blur',
        thumbnail: null,
    },
    {
        id: 'office',
        name: 'Office',
        thumbnail: 'https://mgx-backend-cdn.metadl.com/generate/images/418359/2026-01-27/8fc4a10a-19c4-4f00-bff6-5c8292f9c8f8.png',
    },
];

export const MOCK_DEVICES = {
    cameras: [
        { id: 'camera-1', label: 'HD Webcam (Built-in)' },
        { id: 'camera-2', label: 'External USB Camera' },
    ],
    microphones: [
        { id: 'mic-1', label: 'Default Microphone' },
        { id: 'mic-2', label: 'Headset Microphone' },
    ],
    speakers: [
        { id: 'speaker-1', label: 'Default Speaker' },
        { id: 'speaker-2', label: 'Headphones' },
    ],
};

export const KEYBOARD_SHORTCUTS = [
    { key: 'Alt + A', description: 'Mute/Unmute audio' },
    { key: 'Alt + V', description: 'Start/Stop video' },
    { key: 'Alt + S', description: 'Share screen' },
    { key: 'Alt + H', description: 'Show/Hide chat' },
    { key: 'Alt + U', description: 'Show/Hide participants' },
    { key: 'Alt + R', description: 'Raise/Lower hand' },
    { key: 'Alt + Y', description: 'Open reactions' },
];

// Unique ID Generator
export function generateUniqueId(prefix = 'guest-') {
    return (
        prefix +
        Math.random().toString(36).substring(2, 10) +
        '-' +
        Date.now().toString(36)
    );
}

// Mock Data
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
        isScreenSharing: false,
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
    isActive: true,
    allowMultipleAnswers: false, // Default since not in original usage
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
