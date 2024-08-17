import { Document } from 'langchain/document';

export type AdminAction = 'affirmed' | 'ignore' | 'fixed';

export type Answer = {
  id: string;
  question: string;
  answer: string;
  timestamp: {
    _seconds: number;
    _nanoseconds: number;
  };
  sources?: Document<Record<string, any>>[];
  vote?: number;
  collection?: string;
  ip?: string;
  likeCount: number;
  relatedQuestionsV2?: {
    id: string;
    title: string;
    similarity: number;
  }[];
  related_questions?: string[];
  adminAction?: AdminAction;
  adminActionTimestamp?: {
    _seconds: number;
    _nanoseconds: number;
  };
};

export interface Timestamp {
  _seconds: number;
  _nanoseconds: number;
}
