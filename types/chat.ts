export type MessageType = 'apiMessage' | 'userMessage';

export type Message = {
  type: MessageType;
  message: string;
  isStreaming?: boolean;
  sourceDocs?: Ressource[];
};

export type Ressource = {
  similarity: number;
  id: string;
  content: string;
};

export type TokenUsage = {
  input: number;
  output: number;
};

export type Answer = {
  result: string;
  token_usage: {
    input: number;
    output: number;
  };
  Err: unknown;
  ressources: Ressource[];
};
