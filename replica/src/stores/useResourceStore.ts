import { create } from 'zustand';
import { useChatStore } from './useChatStore';

export interface Resource {
    id: number;
    meeting_id: string;
    sender_id: string;
    sender_name: string;
    type: 'file' | 'link';
    title: string;
    content: string;
    metadata: any;
    timestamp: string;
}

interface ResourceState {
    resources: Resource[];
    isHubOpen: boolean;
    
    setResources: (resources: Resource[]) => void;
    addResource: (resource: Resource) => void;
    toggleHub: () => void;
    setHubOpen: (open: boolean) => void;
    
    shareResource: (meetingId: string, senderId: string, senderName: string, type: 'file' | 'link', title: string, content: string, metadata?: any) => void;
    deleteResource: (id: number, meetingId: string) => void;
    removeResource: (id: number) => void;
    fetchResources: (meetingId: string) => Promise<void>;
}

const API = import.meta.env.VITE_API_URL || '';

export const useResourceStore = create<ResourceState>((set, get) => ({
    resources: [],
    isHubOpen: false,

    setResources: (resources) => set({ resources }),
    addResource: (resource) => set((state) => ({ 
        resources: [resource, ...state.resources.filter(r => r.id !== resource.id)] 
    })),
    toggleHub: () => set((state) => ({ isHubOpen: !state.isHubOpen })),
    setHubOpen: (open) => set({ isHubOpen: open }),

    shareResource: (meetingId, senderId, senderName, type, title, content, metadata = {}) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('share_resource', {
                meeting_id: meetingId,
                sender_id: senderId,
                sender_name: senderName,
                type,
                title,
                content,
                metadata,
                timestamp: new Date().toISOString()
            });
        }
    },

    deleteResource: (id, meetingId) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('delete_resource', { id, meeting_id: meetingId });
        }
    },

    removeResource: (id) => set((state) => ({
        resources: state.resources.filter(r => r.id !== id)
    })),

    fetchResources: async (meetingId) => {
        try {
            const response = await fetch(`${API}/api/resources/${meetingId}`);
            if (response.ok) {
                const data = await response.json();
                set({ resources: data });
            }
        } catch (err) {
            console.error('Error fetching resources:', err);
        }
    }
}));
