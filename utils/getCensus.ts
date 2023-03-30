import { Document } from "./pinecone-client";

const getCensus = async (): Promise<Document[]> => {
    try {
        // TODO: this is hardcoded to middleton, chch - new to add lookup/map
      const response = await fetch('https://www.stats.govt.nz/tools/2018-census-place-summaries/middleton');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
      const documents = mapCensusPlaceToDocument(data);
      return documents;
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  };
  
  const mapCensusPlaceToDocument = (data: any): Document[] => {
    // Map the data to the Document type as required
    // Example: return data.map(item => ({ ...item }));
    // Implement the mapping logic here


    return [{
        pageContent: 'content',
        metadata: {
            "filePath": 'woah'
        }
    }]
  };


  export {
    getCensus,
    mapCensusPlaceToDocument
  }