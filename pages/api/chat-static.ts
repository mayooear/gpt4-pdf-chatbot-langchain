import type { NextApiRequest, NextApiResponse } from 'next';
import { CHAT_PAGE_TITLE, WELCOME_MESSAGE, LOADING_MESSAGE1,
  LOADING_MESSAGE2, PROMPT_ERROR_MESSAGE, FOOTER_URL, FOOTER_TEXT } from '@/config/chat-page';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ CHAT_PAGE_TITLE, WELCOME_MESSAGE, LOADING_MESSAGE1,
    LOADING_MESSAGE2, PROMPT_ERROR_MESSAGE, FOOTER_URL, FOOTER_TEXT });
}