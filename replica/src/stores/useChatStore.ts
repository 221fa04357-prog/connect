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
  selectedRecipientId: string | null;

  // Recording Permission methods
  requestRecordingPermission: (meetingId: string, userId: string, userName: string) => void;
  grantRecordingPermission: (meetingId: string, userId: string) => void;
  denyRecordingPermission: (meetingId: string, userId: string) => void;

  // Video Permission methods
  requestVideoStart: (meetingId: string, targetUserId: string, requesterName: string) => void;
  respondToVideoRequest: (meetingId: string, hostId: string, participantId: string, accepted: boolean) => void;

  // Actions
  initSocket: (meetingId: string, user?: { id: string, name: string, role: string }, initialState?: { isAudioMuted: boolean, isVideoOff: boolean, isHandRaised: boolean }) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage, isChatOpen: boolean) => void;
  setActiveTab: (tab: ChatType) => void;
  setSelectedRecipientId: (id: string | null) => void;
  sendMessage: (content: string, type: ChatType, recipientId?: string, replyTo?: ChatMessage['replyTo']) => void;
  pinMessage: (messageId: string) => void;
  unpinMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  sendTypingStatus: (isTyping: boolean) => void;
  emitParticipantUpdate: (meetingId: string, userId: string, updates: Partial<any>) => void;
  emitReaction: (meetingId: string, reaction: any) => void;
  emitWhiteboardDraw: (meetingId: string, stroke: any) => void;
  emitWhiteboardClear: (meetingId: string) => void;
  emitWhiteboardToggle: (meetingId: string, isOpen: boolean, userId: string) => void;
  emitWhiteboardUndo: (meetingId: string) => void;
  emitWhiteboardRedo: (meetingId: string) => void;
  emitWhiteboardAccessUpdate: (meetingId: string, access: string) => void;
  muteAll: (meetingId: string) => void;
  unmuteAll: (meetingId: string) => void;
  stopVideoAll: (meetingId: string) => void;
  allowVideoAll: (meetingId: string) => void;
  endMeeting: (meetingId: string) => void;
  admitParticipant: (meetingId: string, socketId: string) => void;
  rejectParticipant: (meetingId: string, socketId: string) => void;
  toggleWaitingRoom: (meetingId: string, enabled: boolean) => void;
  updateMeetingSettings: (meetingId: string, settings: Partial<any>) => void;
  deleteMessageForMe: (messageId: string) => void;
  deleteMessageForEveryone: (messageId: string) => void;
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
  selectedRecipientId: null,

  initSocket: (meetingId, user, initialState) => {
    if (get().socket) return;

    // Use the backend API URL for the socket connection
    const socket = io(API, {
      path: '/socket.io'
    });

    socket.on('connect', () => {
      console.log('Connected to chat server');
      // Use persistent guest ID if available
      let userId = user?.id;
      if (!userId) {
        import('./useGuestSessionStore').then((guestStore) => {
          const gId = guestStore.useGuestSessionStore.getState().guestId;
          userId = gId || `guest-${socket.id}`;
          set({ localUserId: userId });
          socket.emit('join_meeting', { meetingId, user, initialState });
        });
      } else {
        set({ localUserId: userId });
        socket.emit('join_meeting', { meetingId, user, initialState });
      }

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

      // Hardware Sync: If the update is for ME, update my local meeting store
      const localUserId = get().localUserId;
      if (data.userId === localUserId) {
        import('./useMeetingStore').then((meetingStore) => {
          const ms = meetingStore.useMeetingStore.getState();

          if (data.updates.role) {
            const nextRole = data.updates.role;
            const hasElevatedRole = nextRole === 'host' || nextRole === 'co-host';

            if (hasElevatedRole) {
              ms.setIsJoinedAsHost(true);
              import('sonner').then(({ toast }) => {
                const label = nextRole === 'host' ? 'Host' : 'Co-Host';
                toast.success(`You have been promoted to ${label}!`);
              });
            } else if (ms.isJoinedAsHost && nextRole === 'participant') {
              ms.setIsJoinedAsHost(false);
              import('sonner').then(({ toast }) => {
                toast.info(`Your role has been changed to participant.`);
              });
            }
          }

          if (data.updates.isAudioMuted !== undefined) {
            if (ms.isAudioMuted !== data.updates.isAudioMuted) {
              ms.setAudioMuted(data.updates.isAudioMuted);
              import('sonner').then(({ toast }) => {
                toast.info(data.updates.isAudioMuted ? 'Your microphone has been muted.' : 'Your microphone has been unmuted.');
              });
            }
          }

          if (data.updates.isVideoOff !== undefined) {
            if (ms.isVideoOff !== data.updates.isVideoOff) {
              ms.setVideoOff(data.updates.isVideoOff);
              import('sonner').then(({ toast }) => {
                toast.info(data.updates.isVideoOff ? 'Your video has been stopped.' : 'Your video has been started.');
              });
            }
          }
        });
      }

      // If any participant turns off their video, host should lose permission control
      if (data.updates.isVideoOff === true) {
        import('./useMeetingStore').then((store) => {
          store.useMeetingStore.getState().setVideoPermission(data.userId, false);
        });
      }
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
          const myId = get().localUserId;
          const participant = ps.participants.find(p => p.id === myId);

          if (participant && participant.role !== 'host') {
            // I am a participant, so I must mute
            if (!ms.isAudioMuted) {
              ms.setAudioMuted(true);
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
            if (ms.isAudioMuted) {
              ms.setAudioMuted(false);
              import('sonner').then(({ toast }) => toast.info('The host has unmuted everyone.'));
            }
          }
        });
      });
    });

    socket.on('stop_video_all', () => {
      import('./useParticipantsStore').then((participantStore) => {
        const ps = participantStore.useParticipantsStore.getState();
        ps.stopVideoAll();

        import('./useMeetingStore').then((meetingStore) => {
          const ms = meetingStore.useMeetingStore.getState();
          const myId = get().localUserId;
          const participant = ps.participants.find(p => p.id === myId);

          if (participant && participant.role !== 'host') {
            // Host disabled video for everyone
            if (!ms.isVideoOff) {
              ms.setVideoOff(true);
              import('sonner').then(({ toast }) => toast.warning('The host has stopped your video.'));
            }
          }
        });
      });
    });

    socket.on('allow_video_all', () => {
      import('./useParticipantsStore').then((participantStore) => {
        const ps = participantStore.useParticipantsStore.getState();
        ps.allowVideoAll();

        import('./useMeetingStore').then((meetingStore) => {
          const ms = meetingStore.useMeetingStore.getState();
          const myId = get().localUserId;
          const participant = ps.participants.find(p => p.id === myId);

          if (participant && participant.role !== 'host') {
            // Restore video state automatically as requested by the user
            if (ms.isVideoOff) {
              ms.setVideoOff(false);
              import('sonner').then(({ toast }) => toast.info('The host has enabled video. Your camera is now ON.'));
            } else {
              import('sonner').then(({ toast }) => toast.info('The host has allowed video.'));
            }
          }
        });
      });
    });

    socket.on('whiteboard_draw', (data: { type: 'start' | 'update' | 'erase' | 'append', stroke?: any, id?: string, points?: [number, number][], initiatorId?: string }) => {
      import('./useMeetingStore').then((meetingStore) => {
        const ms = meetingStore.useMeetingStore.getState();
        if (data.initiatorId) {
          ms.setWhiteboardInitiatorId(data.initiatorId);
        }
        if (data.type === 'start' && data.stroke) {
          ms.addWhiteboardStroke(data.stroke);
          // Auto-open board when drawing starts for others
          if (!ms.isWhiteboardOpen) {
            ms.setWhiteboardOpen(true);
          }
        } else if (data.type === 'update' && data.id && data.points) {
          ms.updateWhiteboardStroke(data.id, data.points);
          // Auto-open if board is closed but drawing is happening (just in case)
          if (!ms.isWhiteboardOpen) {
            ms.setWhiteboardOpen(true);
          }
        } else if (data.type === 'append' && data.id && data.points) {
          ms.appendWhiteboardPoints(data.id, data.points);
        } else if (data.type === 'erase' && data.id) {
          ms.removeWhiteboardStroke(data.id);
        }
      });
    });

    socket.on('whiteboard_clear', () => {
      import('./useMeetingStore').then((meetingStore) => {
        meetingStore.useMeetingStore.getState().clearWhiteboardStrokes();
      });
    });

    socket.on('whiteboard_toggle', (data: { isOpen: boolean, initiatorId?: string }) => {
      import('./useMeetingStore').then((meetingStore) => {
        const ms = meetingStore.useMeetingStore.getState();
        if (data.initiatorId !== undefined) {
          ms.setWhiteboardInitiatorId(data.initiatorId);
        }
        // Use absolute set to avoid inversion race with sessionStorage
        ms.setWhiteboardOpen(data.isOpen);
      });
    });

    socket.on('whiteboard_undo', () => {
      import('./useMeetingStore').then((meetingStore) => {
        meetingStore.useMeetingStore.getState().undoWhiteboardStroke();
      });
    });

    socket.on('whiteboard_redo', () => {
      import('./useMeetingStore').then((meetingStore) => {
        meetingStore.useMeetingStore.getState().redoWhiteboardStroke();
      });
    });

    socket.on('whiteboard_access_updated', (data: { access: string }) => {
      import('./useMeetingStore').then((meetingStore) => {
        const ms = meetingStore.useMeetingStore.getState();
        if (ms.meeting) {
          const nextMeeting = {
            ...ms.meeting,
            settings: {
              ...ms.meeting.settings,
              whiteboardEditAccess: data.access as 'hostOnly' | 'coHost' | 'everyone'
            }
          };
          ms.setMeeting(nextMeeting);
        }
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
        recipientId: message.recipient_id || message.recipientId,
        timestamp: new Date(message.timestamp),
        replyTo: message.reply_to || message.replyTo,
        isPinned: message.is_pinned || message.isPinned,
        isDeletedEveryone: message.is_deleted_everyone || message.isDeletedEveryone,
        deletedFor: message.deleted_for || message.deletedFor || []
      };
      get().addMessage(processedMessage, false);
    });

    socket.on('message_pinned', (data: { messageId: string }) => {
      set((state) => ({
        messages: state.messages.map(m => m.id === data.messageId ? { ...m, isPinned: true } : m)
      }));
    });

    socket.on('message_unpinned', (data: { messageId: string }) => {
      set((state) => ({
        messages: state.messages.map(m => m.id === data.messageId ? { ...m, isPinned: false } : m)
      }));
    });

    socket.on('message_reacted', (data: { messageId: string, reactions: any[] }) => {
      set((state) => ({
        messages: state.messages.map(m =>
          m.id === data.messageId ? { ...m, reactions: data.reactions } : m
        )
      }));
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

    socket.on('message_deleted_everyone', (data: { messageId: string }) => {
      set((state) => ({
        messages: state.messages.map(m =>
          m.id === data.messageId ? { ...m, isDeletedEveryone: true } : m
        )
      }));
    });

    socket.on('waiting_room_status', (data: { status: 'waiting' | 'admitted' | 'rejected', message?: string }) => {
      console.log('Waiting room status update:', data);
      if (data.status === 'admitted') {
        import('./useMeetingStore').then((store) => {
          store.useMeetingStore.getState().setIsWaiting(false);
        });
      } else if (data.status === 'waiting') {
        import('./useMeetingStore').then((store) => {
          store.useMeetingStore.getState().setIsWaiting(true);
        });
      } else if (data.status === 'rejected') {
        import('sonner').then(({ toast }) => toast.error(data.message || 'Access denied'));
        import('./useMeetingStore').then((store) => {
          store.useMeetingStore.getState().leaveMeeting();
          window.location.replace('/#/');
        });
      }
    });

    socket.on('recording_requested', (data: { userId: string, userName: string }) => {
      import('./useMeetingStore').then((store) => {
        const ms = store.useMeetingStore.getState();
        if (ms.isJoinedAsHost) {
          import('sonner').then(({ toast }) => {
            toast.info(`${data.userName} is requesting to record the meeting.`, {
              action: {
                label: 'Allow',
                onClick: () => get().grantRecordingPermission(meetingId, data.userId)
              },
              duration: 10000
            });
          });
        }
      });
    });

    socket.on('recording_granted', (data: { userId?: string, all?: boolean }) => {
      const localId = get().localUserId;
      if (data.all || data.userId === localId) {
        import('./useMeetingStore').then((store) => {
          store.useMeetingStore.getState().setRecordingPermissionStatus('granted');
          import('sonner').then(({ toast }) => toast.success('Recording permission granted. You can now start recording.'));
        });
      }
    });

    socket.on('recording_denied', (data: { userId: string }) => {
      const ms = get().localUserId;
      if (data.userId === ms) {
        import('./useMeetingStore').then((store) => {
          store.useMeetingStore.getState().setRecordingPermissionStatus('denied');
          import('sonner').then(({ toast }) => toast.error('Recording permission denied by the host.'));
        });
      }
    });

    socket.on('video_start_requested', (data: { requesterName: string, requesterId: string }) => {
      import('./useMeetingStore').then((store) => {
        store.useMeetingStore.getState().setVideoRequestState({ status: 'pending', requesterName: data.requesterName, requesterId: data.requesterId });
      });
    });

    socket.on('video_start_response_received', (data: { participantId: string, accepted: boolean }) => {
      import('./useMeetingStore').then((store) => {
        const ms = store.useMeetingStore.getState();
        ms.setVideoPermission(data.participantId, data.accepted);
        if (!data.accepted) {
          import('sonner').then(({ toast }) => {
            const pStore = import('./useParticipantsStore');
            pStore.then(ps => {
              const p = ps.useParticipantsStore.getState().participants.find(part => part.id === data.participantId);
              toast.error(`${p?.name || 'Participant'} declined the video request.`);
            });
          });
        }
      });
    });

    socket.on('waiting_room_update', (waitingParticipants: any[]) => {
      import('./useParticipantsStore').then((store) => {
        store.useParticipantsStore.getState().syncWaitingRoom(waitingParticipants);
      });
    });

    socket.on('waiting_room_setting_updated', (data: { enabled: boolean }) => {
      import('./useParticipantsStore').then((store) => {
        store.useParticipantsStore.getState().setWaitingRoomEnabled(data.enabled);
      });
      import('sonner').then(({ toast }) => {
        toast.info(`Waiting room has been ${data.enabled ? 'enabled' : 'disabled'} by the host.`);
      });
    });

    socket.on('meeting_controls_updated', (settings: any) => {
      import('./useMeetingStore').then((store) => {
        const ms = store.useMeetingStore.getState();
        if (ms.meeting) {
          ms.setMeeting({ ...ms.meeting, settings });

          if (!ms.isJoinedAsHost) {
            if (settings.micAllowed === false && !ms.isAudioMuted) {
              ms.setAudioMuted(true);
              import('sonner').then(({ toast }) => toast.warning('Host has disabled microphones.'));
            }
            if (settings.cameraAllowed === false && !ms.isVideoOff) {
              ms.setVideoOff(true);
              import('sonner').then(({ toast }) => toast.warning('Host has disabled cameras.'));
            }
            if (settings.screenShareAllowed === false && ms.isScreenSharing) {
              if (ms.screenShareStream) {
                ms.screenShareStream.getTracks().forEach(track => track.stop());
              }
              ms.setScreenShareStream(null);
              if (ms.isScreenSharing) {
                ms.toggleScreenShare();
              }
              const localUserId = get().localUserId;
              if (ms.meeting?.id && localUserId) {
                get().emitParticipantUpdate(ms.meeting.id, localUserId, { isScreenSharing: false });
              }
              import('sonner').then(({ toast }) => toast.warning('Host has disabled screen sharing.'));
            }
          }
        }
      });
    });

    set({ socket, meetingId });

    const fetchUserId = user?.id || `guest-${socket.id}`;
    fetch(`${API}/api/messages/${meetingId}`, {
      headers: { 'x-user-id': fetchUserId }
    })
      .then(res => res.json())
      .then(messages => {
        set({
          messages: messages.map((m: any) => ({
            ...m,
            senderId: m.sender_id || m.senderId,
            senderName: m.sender_name || m.senderName,
            recipientId: m.recipient_id || m.recipientId,
            timestamp: new Date(m.timestamp),
            replyTo: m.reply_to || m.replyTo,
            isPinned: m.is_pinned || m.isPinned,
            isDeletedEveryone: m.is_deleted_everyone || m.isDeletedEveryone,
            deletedFor: m.deleted_for || m.deletedFor || []
          }))
        });
      })
      .catch(err => console.error('Error fetching chat history:', err));
  },

  setMessages: (messages) => set({ messages }),

  addMessage: (message, isChatOpen) => set((state) => {
    const isFromMe = message.senderId === state.localUserId || message.senderId === 'current-user';
    const shouldIncrement = !isChatOpen && !isFromMe;
    return {
      messages: [...state.messages, message],
      unreadCount: shouldIncrement ? state.unreadCount + 1 : (isChatOpen ? 0 : state.unreadCount)
    };
  }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedRecipientId: (id) => set({ selectedRecipientId: id }),

  sendMessage: (content, type, recipientId, replyTo) => {
    const { socket, meetingId } = get();
    if (!socket || !meetingId) return;

    import('./useAuthStore').then((auth) => {
      const user = auth.useAuthStore.getState().user;
      socket.emit('send_message', {
        sender_id: user?.id || 'guest',
        sender_name: user?.name || 'Guest',
        content,
        type,
        meeting_id: meetingId,
        recipientId,
        reply_to: replyTo
      });
    });
  },

  pinMessage: (messageId) => {
    const { socket, meetingId } = get();
    if (socket && meetingId) socket.emit('pin_message', { meeting_id: meetingId, messageId });
  },

  unpinMessage: (messageId) => {
    const { socket, meetingId } = get();
    if (socket && meetingId) socket.emit('unpin_message', { meeting_id: meetingId, messageId });
  },

  addReaction: (messageId, emoji) => {
    const { socket, meetingId, localUserId } = get();
    if (socket && meetingId && localUserId) socket.emit('react_to_message', { meeting_id: meetingId, messageId, emoji, userId: localUserId });
  },

  sendTypingStatus: (isTyping) => {
    const { socket, meetingId } = get();
    if (!socket || !meetingId) return;

    import('./useAuthStore').then((auth) => {
      const user = auth.useAuthStore.getState().user;
      if (isTyping) {
        socket.emit('typing_start', { meeting_id: meetingId, userId: user?.id || 'guest', userName: user?.name || 'Guest' });
      } else {
        socket.emit('typing_stop', { meeting_id: meetingId, userId: user?.id || 'guest' });
      }
    });
  },

  deleteMessageForMe: (messageId: string) => {
    const { socket, meetingId, localUserId } = get();
    if (!localUserId) return;
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, deletedFor: [...(m.deletedFor || []), localUserId] } : m)
    }));
    if (socket && meetingId) socket.emit('delete_message_for_me', { meeting_id: meetingId, messageId, userId: localUserId });
  },

  deleteMessageForEveryone: (messageId: string) => {
    const { socket, meetingId } = get();
    if (socket && meetingId) socket.emit('delete_message_for_everyone', { meeting_id: meetingId, messageId });
  },

  emitParticipantUpdate: (meetingId, userId, updates) => {
    get().socket?.emit('update_participant', { meeting_id: meetingId, userId, updates });
  },

  emitReaction: (meetingId, reaction) => {
    get().socket?.emit('send_reaction', { meeting_id: meetingId, reaction });
  },

  emitWhiteboardDraw: (meetingId, stroke) => {
    get().socket?.emit('whiteboard_draw', { meeting_id: meetingId, stroke });
  },

  emitWhiteboardClear: (meetingId) => {
    get().socket?.emit('whiteboard_clear', { meeting_id: meetingId });
  },

  emitWhiteboardToggle: (meetingId, isOpen, userId) => {
    get().socket?.emit('whiteboard_toggle', { meeting_id: meetingId, isOpen, userId });
  },

  emitWhiteboardUndo: (meetingId) => {
    get().socket?.emit('whiteboard_undo', { meeting_id: meetingId });
  },

  emitWhiteboardRedo: (meetingId) => {
    get().socket?.emit('whiteboard_redo', { meeting_id: meetingId });
  },

  emitWhiteboardAccessUpdate: (meetingId, access) => {
    get().socket?.emit('whiteboard_access_update', { meeting_id: meetingId, access });
  },

  muteAll: (meetingId) => {
    get().socket?.emit('mute_all', { meeting_id: meetingId });
  },

  unmuteAll: (meetingId) => {
    get().socket?.emit('unmute_all', { meeting_id: meetingId });
  },

  stopVideoAll: (meetingId) => {
    get().socket?.emit('stop_video_all', { meeting_id: meetingId });
  },

  allowVideoAll: (meetingId) => {
    get().socket?.emit('allow_video_all', { meeting_id: meetingId });
  },

  endMeeting: (meetingId) => {
    get().socket?.emit('end_meeting', { meetingId });
  },

  admitParticipant: (meetingId, socketId) => {
    get().socket?.emit('admit_participant', { meetingId, socketId });
  },

  rejectParticipant: (meetingId, socketId) => {
    get().socket?.emit('reject_participant', { meetingId, socketId });
  },

  toggleWaitingRoom: (meetingId, enabled) => {
    get().socket?.emit('toggle_waiting_room', { meetingId, enabled });
  },

  updateMeetingSettings: (meetingId, settings) => {
    get().socket?.emit('update_meeting_settings', { meetingId, settings });
  },

  requestRecordingPermission: (meetingId, userId, userName) => {
    get().socket?.emit('request_recording', { meetingId, userId, userName });
  },

  grantRecordingPermission: (meetingId, userId) => {
    get().socket?.emit('grant_recording', { meetingId, userId });
  },

  denyRecordingPermission: (meetingId, userId) => {
    get().socket?.emit('deny_recording', { meeting_id: meetingId, userId });
  },

  requestVideoStart: (meetingId, targetUserId, requesterName) => {
    get().socket?.emit('request_video_start', { meetingId, targetUserId, requesterName });
  },

  respondToVideoRequest: (meetingId, hostId, participantId, accepted) => {
    get().socket?.emit('video_start_response', { meetingId, hostId, participantId, accepted });
  },

  markAsRead: () => set({ unreadCount: 0 }),

  reset: () => {
    const { socket } = get();
    if (socket) socket.disconnect();
    set({
      messages: [],
      activeTab: 'public',
      typingUsers: [],
      unreadCount: 0,
      socket: null,
      meetingId: null,
      localUserId: null,
      selectedRecipientId: null
    });
  },
}));
