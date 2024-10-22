import { Document } from 'langchain/document';
import { DocMetadata } from './DocMetadata';
import { RelatedQuestion } from './RelatedQuestion';

export interface ExtendedAIMessage {
  type: 'apiMessage' | 'userMessage';
  message: string;
  sourceDocs?: Document<DocMetadata>[];
  docId?: string;
  collection?: string;
  relatedQuestions?: RelatedQuestion[];
}
