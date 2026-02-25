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
    addTranscript: (segment: TranscriptionSegment) => void;
    setTranscripts: (segments: TranscriptionSegment[]) => void;
    setTranscriptionEnabled: (enabled: boolean) => void;
    clearTranscripts: () => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
    transcripts: [],
    isTranscriptionEnabled: false,
    addTranscript: (segment) => set((state) => ({
        transcripts: [...state.transcripts, segment].slice(-50) // Keep last 50 for live view
    })),
    setTranscripts: (segments) => set({ transcripts: segments }),
    setTranscriptionEnabled: (enabled) => set({ isTranscriptionEnabled: enabled }),
    clearTranscripts: () => set({ transcripts: [] }),
}));
