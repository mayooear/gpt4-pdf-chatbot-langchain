import { Document } from 'langchain/document';

export interface Answer {
    id: string;
    question: string;
    answer: string;
    sources: Document[];
    collection?: string;
    vote?: number; 
    ip: string;
    history: any[]; // more specific here would be better
    timestamp: Timestamp; 
}

export interface Timestamp {
    _seconds: number;
    _nanoseconds: number;
}
  