import {ChatOpenAI, ChatOpenAICallOptions} from 'langchain/chat_models/openai';
import {BaseMessage} from "langchain/schema";

class ExtendedChatOpenAI extends ChatOpenAI {
    async invokeWithImage(messages: BaseMessage[], base64Image: string, options?: ChatOpenAICallOptions) {
        // Modify the messages to include the base64 image
        const imageMessage: BaseMessage = {
            role: "system",
            content: base64Image
        };

        // Add the image message to your messages array
        const updatedMessages = [...messages, imageMessage];

        // Call the original _generate method with the modified messages
        return this._generate(updatedMessages, options);
    }
}
