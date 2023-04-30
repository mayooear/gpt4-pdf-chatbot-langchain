// import { NextApiRequest } from 'next';
// import formidable from 'formidable';

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// export default async function parseForm(req: NextApiRequest): Promise<void> {
//   return new Promise((resolve, reject) => {
//     const form = new formidable.IncomingForm();
//     form.parse(req, (err, fields, files) => {
//       if (err) {
//         reject(err);
//         return;
//       }

//       req.body = fields;
//       req.files = files;
//       resolve();
//     });
//   });
// }