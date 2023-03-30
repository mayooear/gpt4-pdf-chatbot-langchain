import { Document } from "./pinecone-client";

interface Place {
  url: string
  island: 'North'|'South'
  name: string
  wikiUrl: string
}

const places:Place[] = [
  {
    "name": "Northland",
    "island": "North",
    "url": "tools/2018-census-place-summaries/northland-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Northland_Region"
  },
  {
    "name": "Auckland",
    "island": "North",
    "url": "tools/2018-census-place-summaries/auckland-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Auckland_Region"
  },
  {
    "name": "Waikato",
    "island": "North",
    "url": "tools/2018-census-place-summaries/waikato-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Waikato_Region"
  },
  {
    "name": "Bay of Plenty",
    "island": "North",
    "url": "tools/2018-census-place-summaries/bay-of-plenty-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Bay_of_Plenty_Region"
  },
  {
    "name": "Gisborne",
    "island": "North",
    "url": "tools/2018-census-place-summaries/gisborne-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Gisborne_District"
  },
  {
    "name": "Hawke’s Bay",
    "island": "North",
    "url": "tools/2018-census-place-summaries/hawkes-bay-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Hawke%27s_Bay_Region"
  },
  {
    "name": "Taranaki",
    "island": "North",
    "url": "tools/2018-census-place-summaries/taranaki-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Taranaki_Region"
  },
  {
    "name": "Manawatū-Whanganui",
    "island": "North",
    "url": "tools/2018-census-place-summaries/manawatu-whanganui-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Manawat%C5%AB-Whanganui"
  },
  {
    "name": "Wellington",
    "island": "North",
    "url": "tools/2018-census-place-summaries/wellington-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Wellington_Region"
  },
  {
    "name": "Tasman",
    "island": "South",
    "url": "tools/2018-census-place-summaries/tasman-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Tasman_District"
  },
  {
    "name": "Nelson",
    "island": "South",
    "url": "tools/2018-census-place-summaries/nelson-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Nelson,_New_Zealand"
  },
  {
    "name": "Marlborough",
    "island": "South",
    "url": "tools/2018-census-place-summaries/marlborough-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Marlborough_Region"
  },
  {
    "name": "West Coast",
    "island": "South",
    "url": "tools/2018-census-place-summaries/west-coast-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/West_Coast_Region"
  },
  {
    "name": "Canterbury",
    "island": "South",
    "url": "tools/2018-census-place-summaries/canterbury-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Canterbury_Region"
  },
  {
    "name": "Otago",
    "island": "South",
    "url": "tools/2018-census-place-summaries/otago-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Otago_Region"
  },
  {
    "name": "Southland",
    "island": "South",
    "url": "tools/2018-census-place-summaries/southland-region",
    "wikiUrl": "https://en.wikipedia.org/wiki/Southland_Region"
  }
]

const getCensusDataForAllPlaces = async (): Promise<Document[]> => {
  let documents:Document[] = [];
  for (const place of places) {
    const docs = await getDocumentFromPlace(place);
    documents.push(...docs);
  }
  return documents;
};

const getDocumentFromPlace = async (place:Place): Promise<Document[]> => {
    try {
        // TODO: this is hardcoded to middleton, chch - new to add lookup/map
    /*  const wikiResponse = await fetch(place.wikiUrl)
                      .then((res) => {
                        if(!res.ok){
                          throw new Error("res not ok")
                        }

                        return res.text()
                      }).catch((err) => {
                        console.error('Could not get wiki')
                      })
            */          
                      const wikiResponse = {};

      const censusResponse = await fetch(`https://www.stats.govt.nz/${place.url}`, {
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
      }).then((res) => res.json());
      
 
      return mapCensusPlaceToDocument(place, censusResponse, wikiResponse);;
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  };

  const getPlaceDocPageContent = (place:Place, data: any, wikiData: any):string => {

    let pageContent = ''

    pageContent += wikiData

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
    }).join('\n')

    return pageContent;
  }

  const getPlaceDocMetadata = (place:Place, censusData: any, wikiData: any):Record<string,string> => {
    return {
      "region": place.name,
      "island": place.island
    }
  }
  
  const mapCensusPlaceToDocument = (place:Place, censusData: any, wikiData:any): Document[] => {
    // Map the data to the Document type as required
    // Example: return data.map(item => ({ ...item }));
    // Implement the mapping logic here

    const metadata = getPlaceDocMetadata(place, censusData, wikiData);
    const pageContent = getPlaceDocPageContent(place, censusData, wikiData);
    return [{
        pageContent: pageContent,
        metadata: metadata
    }]
  };


  export {
    getCensusDataForAllPlaces,
    mapCensusPlaceToDocument
  }