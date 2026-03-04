import { create } from 'zustand';

interface TranscriptionSegment {
    participantId: string;
    participantName: string;
    text: string;
    timestamp: string;
}

interface TranscriptionState {
    transcripts: TranscriptionSegment[];
    isTranscriptionEnabled: boolean;
    isSettingsOpen: boolean;
    speakingLanguage: string;
    currentCaption: string;
    currentSpeakerName: string;
    currentSpeakerRole: 'host' | 'participant';
    isSummaryOpen: boolean;
    addTranscript: (segment: TranscriptionSegment) => void;
    setTranscripts: (segments: TranscriptionSegment[]) => void;
    setTranscriptionEnabled: (enabled: boolean) => void;
    setSettingsOpen: (open: boolean) => void;
    setSummaryOpen: (open: boolean) => void;
    setSpeakingLanguage: (language: string) => void;
    clearTranscripts: () => void;
    setCurrentCaption: (text: string, name: string, role: 'host' | 'participant') => void;
    clearCurrentCaption: () => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
    transcripts: [],
    isTranscriptionEnabled: false,
    isSettingsOpen: false,
    speakingLanguage: 'English',
    currentCaption: '',
    currentSpeakerName: '',
    currentSpeakerRole: 'participant',
    isSummaryOpen: false,
    addTranscript: (segment) => set((state) => ({
        transcripts: [...state.transcripts, segment].slice(-200)
    })),
    setTranscripts: (segments) => set({ transcripts: segments }),
    setTranscriptionEnabled: (enabled) => set({ isTranscriptionEnabled: enabled }),
    setSettingsOpen: (open) => set({ isSettingsOpen: open }),
    setSummaryOpen: (open) => set({ isSummaryOpen: open }),
    setSpeakingLanguage: (language) => set({ speakingLanguage: language }),
    clearTranscripts: () => set({ transcripts: [] }),
    setCurrentCaption: (text, name, role) => set({ currentCaption: text, currentSpeakerName: name, currentSpeakerRole: role }),
    clearCurrentCaption: () => set({ currentCaption: '', currentSpeakerName: '', currentSpeakerRole: 'participant' }),
}));
