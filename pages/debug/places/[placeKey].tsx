import { useEffect } from 'react';
import { Place, places } from '@/utils/places';
import { getDocumentFromPlace } from '@/utils/getDocumentsForAllPlaces';
import { GetStaticProps } from 'next';
import { Document } from '@/utils/pinecone-client';

interface PlacePageProps {
  place:Place
  placeDocument:Document[]
}
const PlacePage = ({ place, placeDocument }:PlacePageProps) => {
  // const router = useRouter();

  useEffect(() => {
    // Simulate loading data for the place
    // This could be replaced with a real data loading function
    setTimeout(() => {
      console.log(`Data loaded for ${place}`);
    }, 1000);
  }, [place]);

  return (<div>
      <h1>Name:</h1>
      <h1>{place.name}</h1>
      <h1>Place Config:</h1>
      <pre>{JSON.stringify(place, undefined, 4)}</pre>
      <h1>Metadata:</h1>
      <pre>{JSON.stringify(placeDocument[0].metadata, undefined, 4)}</pre>
      <h1>Content:</h1>
      {placeDocument.map((doc) => {
        return (<textarea key={doc.metadata["region"]} defaultValue={JSON.stringify(doc, undefined, 2)} style={{width: '100%', height: '800px'}}/>)
      })}
    </div>
  );
};

export function getStaticPaths() {
  const paths = places.map((place) => ({
    params: { placeKey: place.wikiUrl },
  }));

  return { paths, fallback: false };
}

export const getStaticProps:GetStaticProps<PlacePageProps> = async ({ params }) => {
  const place = places.filter((p) => p.wikiUrl == params?.placeKey)[0]
  if(!place){
    console.error(`no place found for ${params?.placeKey}`)
  }
  const docs = await getDocumentFromPlace(place);
  return {
    props: { 
        place: place,
        placeDocument: docs
    },
  };
}

export default PlacePage;
