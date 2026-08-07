import { apiClient } from './api';

export interface MessageUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string | null;
  createdAt: string;
  sender: MessageUser;
}

export interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  lastMessageAt: string | null;
  participant1: MessageUser;
  participant2: MessageUser;
  messages: ConversationMessage[];
}

export const messageService = {
  async listConversations(): Promise<Conversation[]> {
    const raw = await apiClient.get<{ conversations: Conversation[] }>('/messages/conversations');
    return raw.conversations ?? [];
  },

  async listMessages(conversationId: string): Promise<ConversationMessage[]> {
    const raw = await apiClient.get<{ messages: ConversationMessage[] }>(`/messages/conversations/${conversationId}`);
    return raw.messages ?? [];
  },

  async sendMessage(conversationId: string, text: string): Promise<ConversationMessage> {
    const raw = await apiClient.post<{ message: ConversationMessage }>(`/messages/conversations/${conversationId}`, {
      text,
      type: 'text',
    });
    return raw.message;
  },
};
