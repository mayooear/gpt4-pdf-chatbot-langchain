import { Document } from 'langchain/document';
import { DocMetadata } from './DocMetadata';

export interface ExtendedAIMessage {
  type: 'apiMessage' | 'userMessage';
  message: string;
  sourceDocs?: Document<DocMetadata>[];
  docId?: string;
  collection?: string;
}
