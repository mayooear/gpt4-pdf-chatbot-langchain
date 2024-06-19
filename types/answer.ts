import { Document } from 'langchain/document';

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
};

export interface Timestamp {
    _seconds: number;
    _nanoseconds: number;
}
  