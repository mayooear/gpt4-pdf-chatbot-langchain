const copyTextToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Copy to clipboard failed', error);
    }
  };
  
  export { copyTextToClipboard };
  