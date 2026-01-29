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