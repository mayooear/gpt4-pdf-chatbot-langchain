import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

export const InputAnnotation = Annotation.Root({
    question: Annotation<string>,
    messages: Annotation<BaseMessage[]>({
      reducer: (left: BaseMessage[], right: BaseMessage | BaseMessage[]) => {
        if (Array.isArray(right)) {
          return left.concat(right);
        }
        return left.concat([right]);
      },
      default: () => [],
    }),
  });
  
export const OutputAnnotation = Annotation.Root({
    sourceDocuments: Annotation<Document[]>({
        reducer: (left: Document[], right: Document | Document[]) => {
        if (Array.isArray(right)) {
            return right;
        }
        return [right];
        },
        default: () => [],
    }),
    answer: Annotation<string>
});