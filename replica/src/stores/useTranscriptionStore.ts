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
    isTranscriptOpen: boolean;
    addTranscript: (segment: TranscriptionSegment) => void;
    setTranscripts: (segments: TranscriptionSegment[]) => void;
    setTranscriptionEnabled: (enabled: boolean) => void;
    setSettingsOpen: (open: boolean) => void;
    setSummaryOpen: (open: boolean) => void;
    setTranscriptOpen: (open: boolean) => void;
    setSpeakingLanguage: (language: string) => void;
    clearTranscripts: () => void;
    setCurrentCaption: (text: string, name: string, role: 'host' | 'participant') => void;
    clearCurrentCaption: () => void;
    fontType: string;
    fontSize: string;
    captionColor: string;
    captionPosition: 'bottom' | 'floating';
    setFontType: (font: string) => void;
    setFontSize: (size: string) => void;
    setCaptionColor: (color: string) => void;
    setCaptionPosition: (pos: 'bottom' | 'floating') => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
    transcripts: [],
    isTranscriptionEnabled: (() => {
        try {
            const saved = localStorage.getItem("captions_enabled");
            return saved === null ? true : saved === "true";
        } catch {
            return true;
        }
    })(),
    isSettingsOpen: false,
    speakingLanguage: 'English',
    currentCaption: '',
    currentSpeakerName: '',
    currentSpeakerRole: 'participant',
    isSummaryOpen: false,
    isTranscriptOpen: false,

    fontType: localStorage.getItem("caption_fontType") || 'Inter',
    fontSize: localStorage.getItem("caption_fontSize") || 'normal',
    captionColor: localStorage.getItem("caption_color") || 'white',
    captionPosition: (localStorage.getItem("caption_position") as 'bottom' | 'floating') || 'bottom',

    addTranscript: (segment) => set((state) => ({
        transcripts: [...state.transcripts, segment].slice(-200)
    })),
    setTranscripts: (segments) => set({ transcripts: segments }),
    setTranscriptionEnabled: (enabled) => set(() => {
        try {
            localStorage.setItem("captions_enabled", String(enabled));
        } catch (error) {
            console.error("Failed to save caption state to localStorage", error);
        }
        return { isTranscriptionEnabled: enabled };
    }),
    setSettingsOpen: (open) => set({ isSettingsOpen: open }),
    setSummaryOpen: (open) => set({ isSummaryOpen: open }),
    setTranscriptOpen: (open) => set({ isTranscriptOpen: open }),
    setSpeakingLanguage: (language) => set({ speakingLanguage: language }),
    clearTranscripts: () => set({ transcripts: [] }),
    setCurrentCaption: (text, name, role) => set({ currentCaption: text, currentSpeakerName: name, currentSpeakerRole: role }),
    clearCurrentCaption: () => set({ currentCaption: '', currentSpeakerName: '', currentSpeakerRole: 'participant' }),

    setFontType: (font: string) => set(() => {
        localStorage.setItem("caption_fontType", font);
        return { fontType: font };
    }),
    setFontSize: (size: string) => set(() => {
        localStorage.setItem("caption_fontSize", size);
        return { fontSize: size };
    }),
    setCaptionColor: (color: string) => set(() => {
        localStorage.setItem("caption_color", color);
        return { captionColor: color };
    }),
    setCaptionPosition: (pos: 'bottom' | 'floating') => set(() => {
        localStorage.setItem("caption_position", pos);
        return { captionPosition: pos };
    }),
}));
