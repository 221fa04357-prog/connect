import { create } from 'zustand';

interface MediaState {
    remoteStreams: Record<string, MediaStream>;
    addRemoteStream: (participantId: string, stream: MediaStream) => void;
    removeRemoteStream: (participantId: string) => void;
    clearRemoteStreams: () => void;
}

export const useMediaStore = create<MediaState>((set) => ({
    remoteStreams: {},
    addRemoteStream: (participantId, stream) =>
        set((state) => ({
            remoteStreams: { ...state.remoteStreams, [participantId]: stream }
        })),
    removeRemoteStream: (participantId) =>
        set((state) => {
            const { [participantId]: removed, ...rest } = state.remoteStreams;
            return { remoteStreams: rest };
        }),
    clearRemoteStreams: () => set({ remoteStreams: {} })
}));
