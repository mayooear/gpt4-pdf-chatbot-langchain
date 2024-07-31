declare module 'node-rake' {
  function generate(text: string, options?: { stopwords: string[] }): string[];
  export = { generate };
}