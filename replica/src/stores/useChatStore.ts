import { create } from 'zustand';
import { ChatMessage, ChatType } from '@/types';
import { io, Socket } from 'socket.io-client';

interface ChatState {
  messages: ChatMessage[];
  activeTab: ChatType;
  typingUsers: { userId: string, userName: string }[];
  unreadCount: number;
  socket: Socket | null;
  meetingId: string | null;

  // Actions
  initSocket: (meetingId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage, isChatOpen: boolean) => void;
  setActiveTab: (tab: ChatType) => void;
  sendMessage: (content: string, type: ChatType, recipientId?: string) => void;
  sendTypingStatus: (isTyping: boolean) => void;
  markAsRead: () => void;
  reset: () => void;
}

const API = import.meta.env.VITE_API_URL || '';

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  activeTab: 'public',
  typingUsers: [],
  unreadCount: 0,
  socket: null,
  meetingId: null,

  initSocket: (meetingId) => {
    if (get().socket) return;

    // In Vite, the proxy handles /socket.io
    const socket = io('/', {
      path: '/socket.io'
    });

    socket.on('connect', () => {
      console.log('Connected to chat server');
      socket.emit('join_meeting', meetingId);
    });

    socket.on('receive_message', (message: ChatMessage) => {
      // Convert timestamp string to Date object
      const processedMessage = {
        ...message,
        timestamp: new Date(message.timestamp)
      };
      get().addMessage(processedMessage, false); // TODO: Pass isChatOpen if possible
    });

    socket.on('user_typing', (data: { userId: string, userName: string }) => {
      set((state) => ({
        typingUsers: [...state.typingUsers.filter(u => u.userId !== data.userId), data]
      }));
    });

    socket.on('user_stopped_typing', (data: { userId: string }) => {
      set((state) => ({
        typingUsers: state.typingUsers.filter(u => u.userId !== data.userId)
      }));
    });

    set({ socket, meetingId });

    // Fetch initial messages
    fetch(`${API}/api/messages/${meetingId}`)
      .then(res => res.json())
      .then(messages => {
        set({
          messages: messages.map((m: any) => ({
            ...m,
            senderId: m.sender_id,
            senderName: m.sender_name,
            timestamp: new Date(m.timestamp)
          }))
        });
      })
      .catch(err => console.error('Error fetching chat history:', err));
  },

  setMessages: (messages) => set({ messages }),

  addMessage: (message, isChatOpen) => set((state) => {
    const isFromMe = message.senderId === 'current-user';
    const shouldIncrement = !isChatOpen && !isFromMe;

    return {
      messages: [...state.messages, message],
      unreadCount: shouldIncrement ? state.unreadCount + 1 : (isChatOpen ? 0 : state.unreadCount)
    };
  }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  sendMessage: (content, type, recipientId) => {
    const { socket, meetingId } = get();
    if (!socket || !meetingId) return;

    const messageData = {
      sender_id: 'current-user', // Mock user ID
      sender_name: 'You',
      content,
      type,
      meeting_id: meetingId,
      recipientId
    };

    socket.emit('send_message', messageData);
  },

  sendTypingStatus: (isTyping) => {
    const { socket, meetingId } = get();
    if (!socket || !meetingId) return;

    if (isTyping) {
      socket.emit('typing_start', { meeting_id: meetingId, userId: 'current-user', userName: 'You' });
    } else {
      socket.emit('typing_stop', { meeting_id: meetingId, userId: 'current-user' });
    }
  },

  markAsRead: () => set({ unreadCount: 0 }),

  reset: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    set({
      messages: [],
      activeTab: 'public',
      typingUsers: [],
      unreadCount: 0,
      socket: null,
      meetingId: null
    });
  },
}));
