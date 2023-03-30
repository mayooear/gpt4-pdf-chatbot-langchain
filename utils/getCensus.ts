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

const getCensusForURLs = async (): Promise<Document[]> => {
  const documents:Document[] = [];
  for (const url of censusPlaces) {
    const docs = await processCensusUrl(url);
    documents.push.apply(docs);
  }
  return documents;
};

const processCensusUrl = async (place:CensusPlace): Promise<Document[]> => {
    try {
        // TODO: this is hardcoded to middleton, chch - new to add lookup/map
      const response = await fetch(`https://www.stats.govt.nz/${place.url}`);
      
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
  
  const mapCensusPlaceToDocument = (place:CensusPlace, data: any): Document[] => {
    // Map the data to the Document type as required
    // Example: return data.map(item => ({ ...item }));
    // Implement the mapping logic here
    return [{
        pageContent: 'content',
        metadata: {
            "filePath": 'woah',
            "region": place.name,
            "island": place.island
        }
    }]
  };


  export {
    getCensusForURLs,
    mapCensusPlaceToDocument
  }