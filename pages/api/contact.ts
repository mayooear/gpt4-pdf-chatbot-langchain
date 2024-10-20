import type { NextApiRequest, NextApiResponse } from 'next';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { loadSiteConfigSync } from '@/utils/server/loadSiteConfig';
import validator from 'validator';
import { genericRateLimiter } from '@/utils/server/genericRateLimiter';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';

const ses = new SESClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.AWS_REGION,
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const isAllowed = await genericRateLimiter(req, res, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 3, // 3 requests per 15 minutes
      name: 'contact_form',
    });

    if (!isAllowed) {
      return; // Rate limiter already sent the response
    }

    const { name, email, message } = req.body;

    // Input validation
    if (!validator.isLength(name, { min: 1, max: 100 })) {
      return res.status(400).json({ message: 'Invalid name' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email' });
    }
    if (!validator.isLength(message, { min: 1, max: 1000 })) {
      return res.status(400).json({ message: 'Invalid message length' });
    }

    // Sanitize inputs (only remove potentially harmful characters)
    const sanitizedName = name.trim().replace(/[<>]/g, '');
    const sanitizedEmail = email.trim();
    const sanitizedMessage = message.trim().replace(/[<>]/g, '');

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
          Data: `${siteConfig.shortname} Contact Form Msg from ${sanitizedName}`,
        },
        Body: {
          Text: {
            Data: `From: ${sanitizedName} <${sanitizedEmail}>\n\nMessage:\n\n${sanitizedMessage}`,
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

export default withApiMiddleware(handler);
