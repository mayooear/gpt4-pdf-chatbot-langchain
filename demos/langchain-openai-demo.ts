import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

const embeddings = new OpenAIEmbeddings({
    verbose: true, 
    modelName: 'azure/text-embedding-ada-002',
}, {
    apiKey: '***',
    basePath: '***',
});
(async () => {
    /*
    const embeddings = new OpenAIEmbeddings({
        verbose: true,
        modelName: 'azure/text-embedding-ada-002',
        openAIApiKey: 'f11d7cc34c18059950bfa45f467a4c017198362c03f34c31984cad8692a37769',
    }, {
        apiKey: 'f11d7cc34c18059950bfa45f467a4c017198362c03f34c31984cad8692a37769',
        basePath: 'https://llmproxy.sparrow.spotty.com.cn/llm',
    });
    */
    const res = await embeddings.embedQuery("The food was delicious and the waiter...")
    console.log(res)
})()