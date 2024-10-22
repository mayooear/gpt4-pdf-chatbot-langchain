import { Document } from 'langchain/document';
import { RelatedQuestion } from './RelatedQuestion';

export interface StreamingResponseData {
  token?: string;
  sourceDocs?: Document[];
  done?: boolean;
  error?: string;
  docId?: string;
  relatedQuestions?: RelatedQuestion[];
}
