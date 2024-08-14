const copyTextToClipboard = async (text: string, isHtml: boolean = false) => {
  try {
    if (isHtml && navigator.clipboard.write) {
      const blob = new Blob([text], { type: 'text/html' });
      const clipboardItem = new ClipboardItem({ 'text/html': blob });
      await navigator.clipboard.write([clipboardItem]);
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch (error) {
    console.error('Copy to clipboard failed', error);
  }
};

export { copyTextToClipboard };
