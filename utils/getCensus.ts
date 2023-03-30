import { Document } from "./pinecone-client";

interface CensusPlace {
  url: string
  island: 'North'|'South'
  name: string
}

const censusPlaces:CensusPlace[] = [
  {
    "name": "Northland",
    "island": "North",
    "url": "tools/2018-census-place-summaries/northland-region"
    },
    {
    "name": "Auckland",
    "island": "North",
    "url": "tools/2018-census-place-summaries/auckland-region"
    },
    {
    "name": "Waikato",
    "island": "North",
    "url": "tools/2018-census-place-summaries/waikato-region"
    },
    {
    "name": "Bay of Plenty",
    "island": "North",
    "url": "tools/2018-census-place-summaries/bay-of-plenty-region"
    },
    {
    "name": "Gisborne",
    "island": "North",
    "url": "tools/2018-census-place-summaries/gisborne-region"
    },
    {
    "name": "Hawke’s Bay",
    "island": "North",
    "url": "tools/2018-census-place-summaries/hawkes-bay-region"
    },
    {
    "name": "Taranaki",
    "island": "North",
    "url": "tools/2018-census-place-summaries/taranaki-region"
    },
    {
    "name": "Manawatū-Whanganui",
    "island": "North",
    "url": "tools/2018-census-place-summaries/manawatu-whanganui-region"
    },
    {
    "name": "Wellington",
    "island": "North",
    "url": "tools/2018-census-place-summaries/wellington-region"
    },
    {
    "name": "Tasman",
    "island": "South",
    "url": "tools/2018-census-place-summaries/tasman-region"
    },
    {
    "name": "Nelson",
    "island": "South",
    "url": "tools/2018-census-place-summaries/nelson-region"
    },
    {
    "name": "Marlborough",
    "island": "South",
    "url": "tools/2018-census-place-summaries/marlborough-region"
    },
    {
    "name": "West Coast",
    "island": "South",
    "url": "tools/2018-census-place-summaries/west-coast-region"
    },
    {
    "name": "Canterbury",
    "island": "South",
    "url": "tools/2018-census-place-summaries/canterbury-region"
    },
    {
    "name": "Otago",
    "island": "South",
    "url": "tools/2018-census-place-summaries/otago-region"
    },
    {
    "name": "Southland",
    "island": "South",
    "url": "tools/2018-census-place-summaries/southland-region"
    }
]

const getCensusDataForAllPlaces = async (): Promise<Document[]> => {
  let documents:Document[] = [];
  for (const url of censusPlaces) {
    const docs = await processCensusUrl(url);
    documents.push(...docs);
  }
  return documents;
};

const processCensusUrl = async (place:CensusPlace): Promise<Document[]> => {
    try {
        // TODO: this is hardcoded to middleton, chch - new to add lookup/map
      const response = await fetch(`https://www.stats.govt.nz/${place.url}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.stats.govt.nz/tools/2018-census-place-summaries/middleton',
          'X-Requested-With': 'XMLHttpRequest',
          'SecurityID': '',
          'If-None-Match': '"143aa2e8618e23c718b180c3d3bf553b-gzip"'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
      const documents = mapCensusPlaceToDocument(place, data);
      return documents;
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  };

  const getCensusDocPageContent = (place:CensusPlace, data: any):string => {

    // @ts-ignore
    return data.PageBlocks.map((pb) => {
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
    }).join('\n')
  }

  const getCensusDocMetadata = (place:CensusPlace, data: any):Record<string,string> => {
    return {
      "region": place.name,
      "island": place.island
    }
  }
  
  const mapCensusPlaceToDocument = (place:CensusPlace, data: any): Document[] => {
    // Map the data to the Document type as required
    // Example: return data.map(item => ({ ...item }));
    // Implement the mapping logic here

    const metadata = getCensusDocMetadata(place, data);
    const pageContent = getCensusDocPageContent(place, data);
    return [{
        pageContent: pageContent,
        metadata: metadata
    }]
  };


  export {
    getCensusDataForAllPlaces,
    mapCensusPlaceToDocument
  }