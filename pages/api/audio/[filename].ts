import { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, GetObjectCommand, ListObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from '@/utils/server/awsConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { filename } = req.query;
  const bucketName = process.env.S3_BUCKET_NAME;

  if (typeof filename !== 'string') {
    console.error('Invalid filename:', filename);
    return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `public/audio/${filename}`, 
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 21600 });

    console.log('Generated signed URL:', signedUrl);

    res.redirect(signedUrl);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Detailed error:', error);
      res.status(500).json({ error: 'Error accessing file', details: error.message });
    } else {
      console.error('Unknown error:', error);
      res.status(500).json({ error: 'Error accessing file', details: 'Unknown error' });
    }
  }
}