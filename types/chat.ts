import { Document } from 'langchain/document';

export interface Message {
  type: 'apiMessage' | 'userMessage';
  message: string;
  sourceDocs?: Document[] | null;
  isStreaming?: boolean;
  docId?: string;
  collection?: string;
}
