import { NextApiRequest, NextApiResponse } from 'next';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '@/utils/server/awsConfig';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  const allowedOrigin =
    process.env.NODE_ENV === 'production'
      ? `https://${req.headers.host}`
      : 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { filename } = req.query;
  const bucketName = process.env.S3_BUCKET_NAME;

  if (typeof filename !== 'string') {
    console.error('Invalid filename:', filename);
    return res.status(400).json({ error: 'Invalid filename' });
  }
  try {
    // Remove any leading slashes and 'api/audio/' from the filename
    const cleanFilename = filename.replace(/^\/*(api\/audio\/)*/, '');

    // Determine the appropriate path based on the filename structure.
    // As of 8/2024, the audio files are stored in the 'treasures' folder or bhaktan
    // folder, but pinecone data still has unqualified filenames for treasures files.
    const filePath = cleanFilename.includes('/')
      ? cleanFilename
      : `treasures/${cleanFilename}`;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `public/audio/${filePath}`,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 21600,
    });

    // Send the signed URL back to the client
    res.status(200).json({ url: signedUrl });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Detailed error:', error);
      res
        .status(500)
        .json({ error: 'Error accessing file', details: error.message });
    } else {
      console.error('Unknown error:', error);
      res
        .status(500)
        .json({ error: 'Error accessing file', details: 'Unknown error' });
    }
  }
}

export default withApiMiddleware(handler);
