import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: '***', // defaults to process.env["OPENAI_API_KEY"]
    baseURL: '***'
});
(async () => {
    /*
    const embeddings = new OpenAIEmbeddings({
        verbose: true,
        modelName: 'azure/text-embedding-ada-002',
        openAIApiKey: '***',
    }, {
        apiKey: 'f11d7cc34c18059950bfa45f467a4c017198362c03f34c31984cad8692a37769',
        basePath: '***',
    });
    const res = await embeddings.embedQuery("The food was delicious and the waiter...")
    console.log(res)
    */
    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: '帮我写一篇关于天气的作为' }],
        model: 'azure/gpt-3.5-turbo',
    });
    console.log('chatCompletion', chatCompletion.choices[0].message)
})()