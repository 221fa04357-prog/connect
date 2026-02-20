import { create } from 'zustand';

interface MediaState {
    remoteStreams: Record<string, MediaStream>;
    remoteScreenStreams: Record<string, MediaStream>;
    addRemoteStream: (participantId: string, stream: MediaStream) => void;
    addRemoteScreenStream: (participantId: string, stream: MediaStream) => void;
    removeRemoteStream: (participantId: string) => void;
    removeRemoteScreenStream: (participantId: string) => void;
    clearRemoteStreams: () => void;
}

export const useMediaStore = create<MediaState>((set) => ({
    remoteStreams: {},
    remoteScreenStreams: {},
    addRemoteStream: (participantId, stream) =>
        set((state) => ({
            remoteStreams: { ...state.remoteStreams, [participantId]: stream }
        })),
    addRemoteScreenStream: (participantId, stream) =>
        set((state) => ({
            remoteScreenStreams: { ...state.remoteScreenStreams, [participantId]: stream }
        })),
    removeRemoteStream: (participantId) =>
        set((state) => {
            const { [participantId]: removed, ...rest } = state.remoteStreams;
            return { remoteStreams: rest };
        }),
    removeRemoteScreenStream: (participantId) =>
        set((state) => {
            const { [participantId]: removed, ...rest } = state.remoteScreenStreams;
            return { remoteScreenStreams: rest };
        }),
    clearRemoteStreams: () => set({ remoteStreams: {}, remoteScreenStreams: {} })
}));
