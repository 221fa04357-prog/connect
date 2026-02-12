// Zustand store for chat management

import { create } from 'zustand';
import { ChatMessage, ChatType } from '@/types';
import { generateMockMessages } from '@/utils/mockData';

interface ChatState {
  messages: ChatMessage[];
  activeTab: ChatType;
  typingUsers: string[];
  unreadCount: number;

  // Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage, isChatOpen: boolean) => void;
  setActiveTab: (tab: ChatType) => void;
  addTypingUser: (userId: string) => void;
  removeTypingUser: (userId: string) => void;
  markAsRead: () => void;
  sendMessage: (content: string, type: ChatType, recipientId?: string) => void;
}

// TODO: Connect to backend WebSocket for real-time chat
// WebSocket endpoint: ws://api.example.com/meeting/{meetingId}/chat

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    senderId: 'user-1',
    senderName: 'Alice Johnson',
    content: 'Hello everyone 👋',
    type: 'public',
    timestamp: new Date(),
  },
  {
    id: '2',
    senderId: 'user-2',
    senderName: 'Bob Smith',
    content: 'Can you hear me?',
    type: 'public',
    timestamp: new Date(),
  },
];

export const useChatStore = create<ChatState>((set, get) => ({
  messages: DEMO_MESSAGES,
  activeTab: 'public',
  typingUsers: [],
  unreadCount: 0,

  setMessages: (messages) => set({ messages }),

  // Receive messages via eventBus (simulated frontend-only real-time)
  addMessage: (message, isChatOpen) => set((state) => {
    const isFromMe = message.senderId === 'current-user';
    const shouldIncrement = !isChatOpen && !isFromMe;

    return {
      messages: [...state.messages, message],
      unreadCount: shouldIncrement ? state.unreadCount + 1 : (isChatOpen ? 0 : state.unreadCount)
    };
  }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  // TODO: Broadcast typing indicator via WebSocket
  // WS message: { type: 'typing_start', data: { userId } }
  addTypingUser: (userId) => set((state) => ({
    typingUsers: [...state.typingUsers, userId]
  })),

  // TODO: Broadcast typing stop via WebSocket
  // WS message: { type: 'typing_stop', data: { userId } }
  removeTypingUser: (userId) => set((state) => ({
    typingUsers: state.typingUsers.filter(id => id !== userId)
  })),

  markAsRead: () => set({ unreadCount: 0 }),

  // TODO: Send message via WebSocket
  // WS message: { type: 'send_message', data: { content, type, recipientId } }
  // Expected response: { type: 'message_sent', data: { messageId, timestamp } }
  sendMessage: (content, type, recipientId) => {
    const newMessage: ChatMessage = {
      id: `message-${Date.now()}`,
      senderId: 'current-user',
      senderName: 'You',
      content,
      timestamp: new Date(),
      type,
      recipientId
    };

    set((state) => ({
      messages: [...state.messages, newMessage]
    }));
  }
}));