import { NextApiRequest, NextApiResponse } from 'next';
import WikiJS from 'wikijs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { lat, lng } = req.query;
    const RADIUS = 1000;

    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);

    if (!latNum || !lngNum) {
      res.status(400).json({ error: 'Invalid lat/lng query params' });
    }

    const result = await WikiJS()
      .geoSearch(latNum, lngNum, RADIUS)
      .then((res) => {
        // TODO: do we need to filter to just regions here? Yes
        return res[0];
      })
      .then((pageName) => WikiJS().page(pageName))
      .then((page) => page.summary());

    res.status(200).json({ result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
