import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { prompt, n, resolution } = req.body;
  const api_base = 'https://fagkveld-generativ-ai.openai.azure.com/';
  const api_key = process.env.AZURE_OPENAI_API_KEY || '';
  const api_version = '2023-06-01-preview';
  const url = `${api_base}openai/images/generations:submit?api-version=${api_version}`;
  const headers = {
    'api-key': api_key,
    'Content-Type': 'application/json'
  };
  const body = {
    prompt: prompt,
    n: n,
    resolution: resolution
  };
  const response = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) });
  const submission = await response.json();
  const operation_location = response.headers.get('Operation-Location') || "";

  let status = "";
  while (status !== "succeeded") {
    let retry_after = response.headers.get('Retry-After');
    let waitTime = retry_after ? parseInt(retry_after) : 1;
    await new Promise(r => setTimeout(r, waitTime * 1000));
    const operationResponse = await fetch(operation_location, { headers: headers });
    const data = await operationResponse.json();
    console.log(data);
    status = data.status;
    if (status === 'succeeded') {
        return res.status(200).json({ imageUrls: data.result.data });
    }
  }
}
