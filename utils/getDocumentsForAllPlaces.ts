import WikiJS from 'wikijs';
import { Document } from './pinecone-client';
import { Place, places } from './places';

/**
 * Used Wiki API Data (with some pre-processing)
 */
interface WikiData {
  wikiContent: WikiContent[];
  info: Record<string, string>;
}

interface WikiContent {
  title: string;
  content: string;
}

const getDocumentsForAllPlaces = async (): Promise<Document[]> => {
  let documents: Document[] = [];
  for (const place of places) {
    const docs = await getDocumentFromPlace(place);
    documents.push(...docs);
  }
  return documents;
};

export const getDocumentFromPlace = async (
  place: Place,
): Promise<Document[]> => {
  try {
    // TODO: this is hardcoded to middleton, chch - new to add lookup/map
    /*const wikiResponse = await fetch(`https://en.wikipedia.org${place.wikiUrl}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }})
                      .then((res) => {
                        if(!res.ok){
                          throw new Error("res not ok")
                        }

                        return res.text()
                      }).catch((err) => {
                        console.error('Could not get wiki')
                      })*/

    // const wikiResponse2 = await WikiJS()
    //   .geoSearch(-43.53201440075203, 172.58001124882023, 1000) // -43.53976186003435, 172.58807286468377
    //   .then((res) => {
    //     console.log(res);
    //   });

    const wikiResponse = await WikiJS({
      apiUrl: 'https://en.wikipedia.org/w/api.php',
    })
      .page(place.wikiUrl)
      .then(async (page) => {
        const info = await page.info();
        const content = await page.content();

        return {
          wikiContent: content as unknown as WikiContent[],
          info: info as unknown as Record<string, string>,
        };
      });

    const censusResponse = await fetch(
      `https://www.stats.govt.nz/${place.url}`,
      {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0',
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Referer:
            'https://www.stats.govt.nz/tools/2018-census-place-summaries/middleton',
          'X-Requested-With': 'XMLHttpRequest',
          SecurityID: '',
          'If-None-Match': '"143aa2e8618e23c718b180c3d3bf553b-gzip"',
        },
      },
    ).then((res) => res.json());

    return mapCensusPlaceToDocument(place, censusResponse, wikiResponse);
  } catch (error) {
    console.error(`Error fetching data for ${place.wikiUrl}`, error);
    return [];
  }
};

/**
 * Take all API call data and generate a PineCone document
 * @param place
 * @param censusData
 * @param wikiData
 * @returns Document for PineCone upload
 */
const mapCensusPlaceToDocument = (
  place: Place,
  censusData: any,
  wikiData: WikiData,
): Document[] => {
  // Map the data to the Document type as required
  // Example: return data.map(item => ({ ...item }));
  // Implement the mapping logic here

  const metadata = getPlaceDocMetadata(place, censusData, wikiData);
  const pageContent: string = getPlaceDocPageContent(
    place,
    censusData,
    wikiData,
  );
  return [
    {
      pageContent: pageContent,
      metadata: metadata,
    },
  ];
};

const getPlaceDocMetadata = (
  place: Place,
  censusData: any,
  wikiData: any,
): Record<string, string> => {
  return {
    region: place.name,
    island: place.island,
  };
};

const getPlaceDocPageContent = (
  place: Place,
  data: any,
  wikiData: WikiData,
): string => {
  let pageContent = '';

  pageContent += wikiData.wikiContent
    .map((wikiContentBlock: any) => {
      return `
      TITLE: ${wikiContentBlock.title}
      CONTENT: ${wikiContentBlock.content}
      `;
    })
    .join('&#10;');

  /* 
   TEMP: DONT Include census data yet
   pageContent += Object.keys(wikiData.info).map((infoKey) => `${infoKey?.toUpperCase()}:${wikiData.info[infoKey]}`).join('&#10;')

    // @ts-ignore
    pageContent += data.PageBlocks.map((pb) => {
      switch(pb.ClassName){
        // TODO: use IndicatorBlock entries to replace HighlightData with human-readable meanful names
        case "IndicatorBlock": {
          const data = JSON.parse(pb.HighlightData)
        }

        case "TextBlock": {

        }

        case "GraphTableBlock": {

        }

        case "CensusRecordBlock": {

        }
      }
      return `${pb.Title} ${pb.Intro} ${pb.CensusContent} ${pb.Title} ${pb.HighlightData}`
    }).join('&#10;')*/

  return pageContent;
};

export { getDocumentsForAllPlaces, mapCensusPlaceToDocument };
