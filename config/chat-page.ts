/**  * Set these values in your .env file */
if (!process.env.CHAT_PAGE_TITLE) {
  console.log('.env variables:', process.env);
  console.log('Missing CHAT_PAGE_TITLE in .env file');
}
const CHAT_PAGE_TITLE= process.env.CHAT_PAGE_TITLE ?? 'Chat With Your Legal Docs';
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE ?? 'Hi, what would you like to learn about this legal case?';
const USER_INPUT_PLACEHOLDER = process.env.USER_INPUT_PLACEHOLDER ?? 'What is this legal case about?';
const FOOTER_URL = process.env.FOOTER_URL ?? 'https://twitter.com/mayowaoshin';
const FOOTER_TEXT = process.env.FOOTER_TEXT ?? 'Powered by LangChainAI. Demo built by Mayo (Twitter: @mayowaoshin).';


export { CHAT_PAGE_TITLE, WELCOME_MESSAGE,
  USER_INPUT_PLACEHOLDER, FOOTER_URL, FOOTER_TEXT };
