export type MessageType = 'public' | 'private';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId?: string; // For private messages
  recipientName?: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  isRead?: boolean;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  timestamp: Date;
}