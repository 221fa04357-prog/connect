import { create } from 'zustand';
import { useChatStore } from './useChatStore';

export interface PollVote {
    user_id: string;
    option_index: number;
}

export interface Poll {
    id: number;
    meeting_id: string;
    creator_id: string;
    question: string;
    options: string[];
    is_anonymous: boolean;
    is_quiz: boolean;
    correct_option_index: number | null;
    status: 'open' | 'closed';
    votes: PollVote[];
    created_at: string;
}

interface PollState {
    polls: Poll[];
    isPollPanelOpen: boolean;
    
    setPolls: (polls: Poll[]) => void;
    setPollPanelOpen: (open: boolean) => void;
    
    createPoll: (meetingId: string, creatorId: string, pollData: Partial<Poll>) => void;
    votePoll: (meetingId: string, pollId: number, userId: string, optionIndex: number) => void;
    closePoll: (meetingId: string, pollId: number) => void;
    fetchPolls: (meetingId: string) => void;
    updatePollVotes: (pollId: number, votes: PollVote[]) => void;
}

export const usePollStore = create<PollState>((set, get) => ({
    polls: [],
    isPollPanelOpen: false,

    setPolls: (polls) => set({ polls }),
    setPollPanelOpen: (open) => set({ isPollPanelOpen: open }),

    createPoll: (meetingId, creatorId, pollData) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('create_poll', { meeting_id: meetingId, creator_id: creatorId, ...pollData });
        }
    },

    votePoll: (meetingId, pollId, userId, optionIndex) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('vote_poll', { meeting_id: meetingId, poll_id: pollId, user_id: userId, option_index: optionIndex });
        }
    },

    closePoll: (meetingId, pollId) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('close_poll', { meeting_id: meetingId, poll_id: pollId });
        }
    },

    fetchPolls: (meetingId) => {
        const socket = useChatStore.getState().socket;
        if (socket) {
            socket.emit('fetch_polls', { meeting_id: meetingId });
        }
    },

    updatePollVotes: (pollId, votes) => {
        set((state) => ({
            polls: state.polls.map(p => p.id === pollId ? { ...p, votes } : p)
        }));
    }
}));
