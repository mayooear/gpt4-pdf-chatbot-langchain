//import dotenv from 'dotenv';
//dotenv.config();
/**  * Set these values in your .env file */

if (!process.env.CHAT_PAGE_TITLE) {
  console.log('.env variables:', process.env);
  console.log('Missing CHAT_PAGE_TITLE in .env file');
  //throw new Error('Missing CHAT_PAGE_TITLE in .env file');
}

//export const CHAT_PAGE_TITLE= process.env.local.CHAT_PAGE_TITLE ?? '';
//export const WELCOME_MESSAGE = process.env.local.WELCOME_MESSAGE ?? '';
const CHAT_PAGE_TITLE= process.env.CHAT_PAGE_TITLE ?? '';
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE ?? '';
const LOADING_MESSAGE1 = process.env.LOADING_MESSAGE1 ?? '';
const LOADING_MESSAGE2 = process.env.LOADING_MESSAGE2 ?? '';
const PROMPT_ERROR_MESSAGE = process.env.PROMPT_ERROR_MESSAGE ?? '';
const FOOTER_URL = process.env.FOOTER_URL ?? '';
const FOOTER_TEXT = process.env.FOOTER_TEXT ?? '';


export { CHAT_PAGE_TITLE, WELCOME_MESSAGE, LOADING_MESSAGE1,
  LOADING_MESSAGE2, PROMPT_ERROR_MESSAGE, FOOTER_URL, FOOTER_TEXT };
