import type { NextApiRequest, NextApiResponse } from 'next';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { graph } from '@/langgraph/graph';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history } = req.body;

  console.log('question', question);
  console.log('history', history);

  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const pastMessages = history
      .map((message: [string, string]) => {
        return [new HumanMessage(message[0]), new AIMessage(message[1])]
      })
    console.log(pastMessages);

    //Ask a question using chat history
    const response = await graph.invoke({ question: sanitizedQuestion, messages: pastMessages });

    const sourceDocuments = response.sourceDocuments;

    console.log('response', response);
    res.status(200).json({ text: response.answer, sourceDocuments });
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
