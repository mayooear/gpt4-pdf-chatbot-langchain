import { Document } from 'langchain/document';

export interface StreamingResponseData {
  token?: string;
  sourceDocs?: Document[];
  done?: boolean;
  error?: string;
  docId?: string;
}
