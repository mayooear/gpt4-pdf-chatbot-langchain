import type { NextApiRequest, NextApiResponse } from 'next';
import AWS from 'aws-sdk';
// import fetch from 'node-fetch';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const ses = new AWS.SES({ apiVersion: '2010-12-01' });

// const verifyRecaptcha = async (token: string) => {
//   const secretKey = process.env.RECAPTCHA_SECRET_KEY;
//   const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/x-www-form-urlencoded',
//     },
//     body: `secret=${secretKey}&response=${token}`,
//   });
//   const data = await response.json();
//   return data.success;
// };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { name, email, message /*, recaptchaToken */ } = req.body;

    // if (!recaptchaToken) {
    //   return res.status(400).json({ message: 'reCAPTCHA token is missing' });
    // }

    // const isHuman = await verifyRecaptcha(recaptchaToken);
    // if (!isHuman) {
    //   return res.status(400).json({ message: 'reCAPTCHA verification failed' });
    // }

    const sourceEmail = process.env.CONTACT_EMAIL;
    if (!sourceEmail) {
      return res.status(500).json({ message: 'CONTACT_EMAIL environment variable is not set' });
    }

    const params: AWS.SES.SendEmailRequest = {
      Source: sourceEmail,
      Destination: {
        ToAddresses: [sourceEmail],
      },
      Message: {
        Subject: {
          Data: `Ananda Chatbot Contact Form Msg from ${name}`,
        },
        Body: {
          Text: {
            Data: `From: ${name} <${email}>\n\nMessage: ${message}`,
          },
        },
      },
    };

    try {
      await ses.sendEmail(params).promise();
      res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ message: 'Failed to send message', error });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}