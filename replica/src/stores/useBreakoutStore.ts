import { create } from 'zustand';
import { useChatStore } from './useChatStore';

export interface BreakoutRoom {
    id: string;
    name: string;
    participants: string[]; // userIds
}

interface BreakoutState {
    rooms: BreakoutRoom[];
    currentRoomId: string | null;
    isBreakoutActive: boolean;
    
    setRooms: (rooms: BreakoutRoom[]) => void;
    setCurrentRoomId: (id: string | null) => void;
    setBreakoutActive: (active: boolean) => void;
    
    createRooms: (meetingId: string, rooms: BreakoutRoom[]) => void;
    joinRoom: (meetingId: string, roomId: string) => void;
    leaveRoom: (meetingId: string, roomId: string) => void;
    closeRooms: (meetingId: string) => void;
}

export const useBreakoutStore = create<BreakoutState>((set, get) => ({
    rooms: [],
    currentRoomId: null,
    isBreakoutActive: false,

    setRooms: (rooms) => set({ rooms }),
    setCurrentRoomId: (id) => set({ currentRoomId: id }),
    setBreakoutActive: (active) => set({ isBreakoutActive: active }),

    createRooms: (meetingId, rooms) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('create_breakout_rooms', { meeting_id: meetingId, rooms });
        }
    },

    joinRoom: (meetingId, roomId) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('join_breakout_room', { meeting_id: meetingId, room_id: roomId });
            set({ currentRoomId: roomId });
        }
    },

    leaveRoom: (meetingId, roomId) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('leave_breakout_room', { meeting_id: meetingId, room_id: roomId });
            set({ currentRoomId: null });
        }
    },

    closeRooms: (meetingId) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('close_breakout_rooms', { meeting_id: meetingId });
        }
    }
}));
