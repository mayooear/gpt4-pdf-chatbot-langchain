import type { NextApiRequest, NextApiResponse } from 'next';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { loadSiteConfigSync } from '@/utils/server/loadSiteConfig';

const ses = new SESClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.AWS_REGION,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'POST') {
    const { name, email, message } = req.body;

    const sourceEmail = process.env.CONTACT_EMAIL;
    if (!sourceEmail) {
      return res
        .status(500)
        .json({ message: 'CONTACT_EMAIL environment variable is not set' });
    }

    const siteConfig = loadSiteConfigSync();
    if (!siteConfig) {
      return res
        .status(500)
        .json({ message: 'Failed to load site configuration' });
    }

    const params = {
      Source: sourceEmail,
      Destination: {
        ToAddresses: [sourceEmail],
      },
      Message: {
        Subject: {
          Data: `${siteConfig.shortname} Contact Form Msg from ${name}`,
        },
        Body: {
          Text: {
            Data: `From: ${name} <${email}>\n\nMessage:\n\n${message}`,
          },
        },
      },
    };

    try {
      await ses.send(new SendEmailCommand(params));
      res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ message: 'Failed to send message', error });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
