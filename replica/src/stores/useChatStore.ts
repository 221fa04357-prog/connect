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
  localUserId: string | null;

  // Actions
  initSocket: (meetingId: string, user?: { id: string, name: string, role: string }, initialState?: { isAudioMuted: boolean, isVideoOff: boolean, isHandRaised: boolean }) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage, isChatOpen: boolean) => void;
  setActiveTab: (tab: ChatType) => void;
  sendMessage: (content: string, type: ChatType, recipientId?: string) => void;
  sendTypingStatus: (isTyping: boolean) => void;
  emitParticipantUpdate: (meetingId: string, userId: string, updates: Partial<any>) => void;
  emitReaction: (meetingId: string, reaction: any) => void;
  muteAll: (meetingId: string) => void;
  unmuteAll: (meetingId: string) => void;
  endMeeting: (meetingId: string) => void;
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
  localUserId: null,

  initSocket: (meetingId, user, initialState) => {
    if (get().socket) return;

    // Use the backend API URL for the socket connection
    const socket = io(API, {
      path: '/socket.io'
    });

    socket.on('connect', () => {
      console.log('Connected to chat server');
      const userId = user?.id || `guest-${socket.id}`;
      set({ localUserId: userId });
      socket.emit('join_meeting', { meetingId, user, initialState });

      // Update connection quality
      import('./useMeetingStore').then((store) => {
        store.useMeetingStore.getState().setConnectionQuality('good');
      });
    });

    socket.on('disconnect', (reason) => {
      console.warn('Disconnected from chat server:', reason);
      import('./useMeetingStore').then((store) => {
        store.useMeetingStore.getState().setConnectionQuality('offline');
      });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      import('./useMeetingStore').then((store) => {
        store.useMeetingStore.getState().setConnectionQuality('offline');
      });
    });

    socket.on('participants_update', (participants: any[]) => {
      // Import store here to avoid circular dependency
      import('./useParticipantsStore').then((store) => {
        store.useParticipantsStore.getState().syncParticipants(participants.map(p => ({
          ...p,
          // Fallback defaults only if server/payload is missing them
          isAudioMuted: p.isAudioMuted ?? true,
          isVideoOff: p.isVideoOff ?? true,
          isHandRaised: p.isHandRaised ?? false,
          isSpeaking: false,
          isPinned: false,
          isSpotlighted: false,
          avatar: '#0B5CFF'
        })));
      });
    });

    socket.on('participant_updated', (data: { userId: string, updates: any }) => {
      import('./useParticipantsStore').then((store) => {
        store.useParticipantsStore.getState().updateParticipant(data.userId, data.updates);
      });
    });

    socket.on('receive_reaction', (reaction: any) => {
      import('./useMeetingStore').then((store) => {
        store.useMeetingStore.getState().addReaction(reaction);
      });
    });

    socket.on('mute_all', () => {
      import('./useParticipantsStore').then((participantStore) => {
        const ps = participantStore.useParticipantsStore.getState();
        ps.muteAll(); // update participant list UI

        // Check if I am a scalable participant (not host)
        import('./useMeetingStore').then((meetingStore) => {
          const ms = meetingStore.useMeetingStore.getState();
          // If I am not the host, I should mute my audio
          // Logic: check if my user ID matches host. 
          // However, 'muteAll' usually means "everyone but the sender/host".
          // The socket broadcast sends to everyone.
          // We need to check if *I* initiated it? 
          // Actually, standard behavior: Mute everyone except the person who triggered it?
          // Or if host triggers it, host stays unmuted?
          // Let's rely on role.
          const myId = get().localUserId;
          const participant = ps.participants.find(p => p.id === myId);

          if (participant && participant.role !== 'host') {
            // I am a participant, so I must mute
            ms.toggleAudio(); // This toggles. We need setAudioMuted(true).
            // useMeetingStore doesn't have setAudioMuted, it has toggleAudio.
            // Let's check state first.
            if (!ms.isAudioMuted) {
              ms.toggleAudio();
              import('sonner').then(({ toast }) => toast.info('The host has muted everyone.'));
            }
          }
        });
      });
    });

    socket.on('unmute_all', () => {
      import('./useParticipantsStore').then((participantStore) => {
        const ps = participantStore.useParticipantsStore.getState();
        ps.unmuteAll(); // update participant list UI to show mic icons as active (or at least not forced muted)

        // Check if I am a scalable participant (not host)
        import('./useMeetingStore').then((meetingStore) => {
          const ms = meetingStore.useMeetingStore.getState();
          const myId = get().localUserId;
          const participant = ps.participants.find(p => p.id === myId);

          if (participant && participant.role !== 'host') {
            // Should we auto-unmute? Usually privacy concerns say NO.
            // But user requirement: "changes should be synchronized and visible... immediately"
            // This implies state sync. 
            // Let's UN-MUTE them to match the "Enable All" request, but maybe show a toast.
            if (ms.isAudioMuted) {
              ms.toggleAudio();
              import('sonner').then(({ toast }) => toast.info('The host has unmuted everyone.'));
            }
          }
        });
      });
    });

    socket.on('meeting_ended', () => {
      console.log('Meeting has been ended by the host');
      import('./useMeetingStore').then((store) => {
        const meetingStore = store.useMeetingStore.getState();
        meetingStore.leaveMeeting();
        // App uses HashRouter (/#/ prefix) so we must use replace to properly navigate
        window.location.replace('/#/');
      });
    });

    socket.on('receive_message', (message: any) => {
      // Map backend snake_case to frontend camelCase
      const processedMessage: ChatMessage = {
        ...message,
        senderId: message.sender_id || message.senderId,
        senderName: message.sender_name || message.senderName,
        recipientId: message.recipient_id || message.recipientId, // Added mapping
        timestamp: new Date(message.timestamp)
      };
      get().addMessage(processedMessage, false);
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
    console.log(`useChatStore: Fetching chat history for ${meetingId} from ${API || '/api'}`);
    fetch(`${API}/api/messages/${meetingId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(messages => {
        console.log(`useChatStore: Loaded ${messages.length} messages`);
        set({
          messages: messages.map((m: any) => ({
            ...m,
            senderId: m.sender_id || m.senderId,
            senderName: m.sender_name || m.senderName,
            recipientId: m.recipient_id || m.recipientId, // Added mapping
            timestamp: new Date(m.timestamp)
          }))
        });
      })
      .catch(err => {
        console.error('Error fetching chat history:', err);
        // Retry logic could be added here
      });
  },

  setMessages: (messages) => set({ messages }),

  addMessage: (message, isChatOpen) => set((state) => {
    // identify local user by checking against state.localUserId 
    // fallback if not yet set
    const isFromMe = message.senderId === state.localUserId || message.senderId === 'current-user';
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

    // Import auth store here to avoid circular dependency
    import('./useAuthStore').then((auth) => {
      const user = auth.useAuthStore.getState().user;
      const messageData = {
        sender_id: user?.id || 'guest',
        sender_name: user?.name || 'Guest',
        content,
        type,
        meeting_id: meetingId,
        recipientId
      };
      socket.emit('send_message', messageData);
    });
  },

  sendTypingStatus: (isTyping) => {
    const { socket, meetingId } = get();
    if (!socket || !meetingId) return;

    import('./useAuthStore').then((auth) => {
      const user = auth.useAuthStore.getState().user;
      if (isTyping) {
        socket.emit('typing_start', {
          meeting_id: meetingId,
          userId: user?.id || 'guest',
          userName: user?.name || 'Guest'
        });
      } else {
        socket.emit('typing_stop', {
          meeting_id: meetingId,
          userId: user?.id || 'guest'
        });
      }
    });
  },

  emitParticipantUpdate: (meetingId, userId, updates) => {
    get().socket?.emit('update_participant', { meeting_id: meetingId, userId, updates });
  },

  emitReaction: (meetingId, reaction) => {
    get().socket?.emit('send_reaction', { meeting_id: meetingId, reaction });
  },

  muteAll: (meetingId) => {
    get().socket?.emit('mute_all', { meeting_id: meetingId });
  },

  unmuteAll: (meetingId) => {
    get().socket?.emit('unmute_all', { meeting_id: meetingId });
  },

  endMeeting: (meetingId) => {
    get().socket?.emit('end_meeting', { meetingId });
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
      meetingId: null,
      localUserId: null
    });
  },
}));
