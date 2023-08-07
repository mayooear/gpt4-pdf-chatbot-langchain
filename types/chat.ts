import type { Ressource } from 'polyfact';

export type MessageType = 'apiMessage' | 'userMessage';

export type Message = {
  type: MessageType;
  message: string;
  isStreaming?: boolean;
  sourceDocs?: Ressource[];
};
