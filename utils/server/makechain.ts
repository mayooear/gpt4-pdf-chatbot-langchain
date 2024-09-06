import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  RunnableSequence,
  RunnablePassthrough,
} from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Document } from 'langchain/document';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import fs from 'fs/promises';
import path from 'path';

type AnswerChainInput = {
  question: string;
  chat_history: string;
};

export type CollectionKey = 'master_swami' | 'whole_library';

interface TemplateContent {
  content?: string;
  file?: string;
}

interface SiteConfig {
  variables: Record<string, string>;
  templates: Record<string, TemplateContent>;
}

async function loadTextFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    console.warn(`Failed to load file: ${filePath}. Using empty string.`);
    return '';
  }
}

async function processTemplate(
  template: TemplateContent,
  variables: Record<string, string>,
  basePath: string,
): Promise<string> {
  let content = template.content || '';
  if (template.file) {
    content = await loadTextFile(path.join(basePath, template.file));
  }
  return substituteVariables(content, variables);
}

function substituteVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\${(\w+)}/g,
    (_, key) => variables[key] || `\${${key}}`,
  );
}

async function loadSiteConfig(siteId: string): Promise<SiteConfig> {
  const promptsDir =
    process.env.SITE_PROMPTS_DIR ||
    path.join(process.cwd(), 'site-config/prompts');
  const configPath = path.join(promptsDir, `${siteId}.json`);

  try {
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(
      `Failed to load site-specific config for ${siteId}. Using default.`,
    );
    const defaultPath = path.join(promptsDir, 'default.json');
    const defaultData = await fs.readFile(defaultPath, 'utf8');
    return JSON.parse(defaultData);
  }
}

async function processSiteConfig(
  config: SiteConfig,
  basePath: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {
    ...config.variables,
    date: new Date().toLocaleDateString(),
  };

  for (const [key, template] of Object.entries(config.templates)) {
    result[key] = await processTemplate(template, result, basePath);
  }

  return result;
}

const getFullTemplate = async (siteId: string) => {
  const promptsDir =
    process.env.SITE_PROMPTS_DIR ||
    path.join(process.cwd(), 'site-config/prompts');
  const config = await loadSiteConfig(siteId);
  const processedConfig = await processSiteConfig(config, promptsDir);

  // Get the base template
  let fullTemplate = processedConfig.baseTemplate || '';

  // Replace variables from the 'variables' object
  if (config.variables) {
    for (const [key, value] of Object.entries(config.variables)) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      fullTemplate = fullTemplate.replace(placeholder, value);
    }
  }

  return fullTemplate;
};

// Keep the existing CONDENSE_TEMPLATE for backwards compatibility
const CONDENSE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

const combineDocumentsFn = (docs: Document[]) => {
  const serializedDocs = docs.map((doc) => ({
    content: doc.pageContent,
    metadata: doc.metadata,
    // 9/4/24 MO: Note this was formerly doc.id before estype checking was added. maybe this is
    // going to break?
    id: doc.metadata.id,
  }));
  return JSON.stringify(serializedDocs);
};

export const makeChain = async (retriever: VectorStoreRetriever) => {
  const siteId = process.env.SITE_ID || 'default';
  const condenseQuestionPrompt =
    ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);

  // Get the full template
  const fullTemplate = await getFullTemplate(siteId);

  // Replace only the dynamic variables
  const templateWithReplacedVars = fullTemplate.replace(
    /\${(context|chat_history|question)}/g,
    (match, key) => `{${key}}`,
  );

  const answerPrompt = ChatPromptTemplate.fromTemplate(
    templateWithReplacedVars,
  );

  const model = new ChatOpenAI({
    temperature: 0,
    modelName: 'gpt-4o',
  });

  // Rephrase the initial question into a dereferenced standalone question based on
  // the chat history to allow effective vectorstore querying.
  const standaloneQuestionChain = RunnableSequence.from([
    condenseQuestionPrompt,
    model,
    new StringOutputParser(),
  ]);

  // Retrieve documents based on a query, then format them.
  const retrievalChain = retriever.pipe((docs: Document[]) => ({
    documents: docs,
    combinedContent: combineDocumentsFn(docs),
  }));

  // Generate an answer to the standalone question based on the chat history
  // and retrieved documents. Additionally, we return the source documents directly.
  const answerChain = RunnableSequence.from([
    {
      context: RunnableSequence.from([
        new RunnablePassthrough<AnswerChainInput>(),
        async (input: AnswerChainInput) =>
          retrievalChain.invoke(input.question),
        (output: { combinedContent: string }) => output.combinedContent,
      ]),
      chat_history: (input: AnswerChainInput) => input.chat_history,
      question: (input: AnswerChainInput) => input.question,
      documents: RunnableSequence.from([
        new RunnablePassthrough<AnswerChainInput>(),
        async (input: AnswerChainInput) =>
          retrievalChain.invoke(input.question),
        (output: { documents: Document[] }) => output.documents,
      ]),
    },
    answerPrompt,
    model,
    new StringOutputParser(),
  ]);

  // First generate a standalone question, then answer it based on
  // chat history and retrieved context documents.
  const conversationalRetrievalQAChain = RunnableSequence.from([
    {
      question: RunnableSequence.from([
        (input: AnswerChainInput) => input,
        standaloneQuestionChain,
      ]),
      chat_history: (input: AnswerChainInput) => input.chat_history,
    },
    answerChain,
  ]);

  return conversationalRetrievalQAChain;
};
