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
    currentCaption: string; // The live, auto-clearing caption shown as overlay
    addTranscript: (segment: TranscriptionSegment) => void;
    setTranscripts: (segments: TranscriptionSegment[]) => void;
    setTranscriptionEnabled: (enabled: boolean) => void;
    clearTranscripts: () => void;
    setCurrentCaption: (text: string) => void;
    clearCurrentCaption: () => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
    transcripts: [],
    isTranscriptionEnabled: false,
    currentCaption: '',
    addTranscript: (segment) => set((state) => ({
        transcripts: [...state.transcripts, segment].slice(-50) // Keep last 50 for recap history
    })),
    setTranscripts: (segments) => set({ transcripts: segments }),
    setTranscriptionEnabled: (enabled) => set({ isTranscriptionEnabled: enabled }),
    clearTranscripts: () => set({ transcripts: [] }),
    setCurrentCaption: (text) => set({ currentCaption: text }),
    clearCurrentCaption: () => set({ currentCaption: '' }),
}));
