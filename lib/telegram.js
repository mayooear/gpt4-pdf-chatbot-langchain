import TelegramBot from 'node-telegram-bot-api';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let bot;

if (TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN); // No polling needed if only sending messages
  console.log("Telegram bot client initialized.");
} else {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Telegram functionality will be disabled.");
}

/**
 * Sends a PDF document via Telegram.
 * @param {string|number} chatId The target chat ID.
 * @param {Buffer} pdfBuffer The PDF content as a Buffer.
 * @param {string} [caption] Optional caption for the document.
 * @param {string} [filename='report.pdf'] Optional filename for the document.
 * @returns {Promise<void>}
 * @throws {Error} If sending fails or Telegram bot is not configured.
 */
export const sendTelegramReport = async (chatId, pdfBuffer, caption = '', filename = 'report.pdf') => {
  if (!bot) {
    throw new Error("Telegram Bot Token not configured. Cannot send message.");
  }
  if (!chatId) {
    throw new Error("Telegram Chat ID ('chatId') is required.");
  }
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error("PDF Buffer is empty or invalid.");
  }

  try {
    // Send the document
    // The `file` option needs to be a Buffer or a Stream.
    // `filename` is passed in the options object for `sendDocument`.
    await bot.sendDocument(
      chatId,
      pdfBuffer,
      { caption: caption },
      { filename: filename, contentType: 'application/pdf' }
    );
    console.log(`Telegram document sent successfully to chat ID ${chatId}.`);
  } catch (error) {
    console.error("Error sending document via Telegram:", error);
    // Check for specific error details if available (e.g., error.response.body on API errors)
    throw new Error(`Failed to send Telegram document: ${error.message}`);
  }
};
