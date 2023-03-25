import 'dotenv'
import { PDFLoader } from 'langchain/document_loaders';
import { htmlToText } from 'html-to-text';
import glob from 'glob';
import fs from 'fs/promises'
/* Name of directory to retrieve files from. You can change this as required */
const filePath = 'docs/MorseVsFrederick.pdf';
const hpFilePath = 'docs/hp-data/90151.html'


type SourceOptions = 'html-files'|'org-pdf'| 'hp-files' | undefined


interface Document {
  pageContent: string
  metadata: Record<string,string>
}

const getRawData = async ():Promise<Document[]> => {
  const source:SourceOptions = process.env.SOURCE_FILES as SourceOptions // 'OrgPDF'

  if(!source){
    throw new Error("No SOURCE_FILES");
  }

  if(source == 'org-pdf'){
    const loader = new PDFLoader(filePath);

    const rawDocs = await loader.load();

    return rawDocs;
  } else if(source == 'hp-files'){

    const htmlContent = await fs.readFile(hpFilePath, 'utf-8');
    const metadata:Record<string,string> = {"filePath": hpFilePath}

    return [{
      pageContent: htmlToText(htmlContent, {
        //      ignoreHref: true,
       //       ignoreImage: true,
            }),
      metadata: metadata
    }]
  }else if(source == 'html-files') {
    const filePaths = glob.sync('docs/**/*.+(html|htm)');

    /* Extract the content without any HTML tags */
    const rawDocsPromises = filePaths.map(async (filePath:string):Promise<Document> => {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      const metadata:Record<string,string> = {"filePath": filePath}
      
      return {
        pageContent: htmlToText(htmlContent, {
          //      ignoreHref: true,
         //       ignoreImage: true,
              }),
        metadata: metadata
      }
      
    });
  
    const rawDocsResults = await Promise.allSettled(rawDocsPromises);
  
    // Filter out the rejected promises and log the errors
    const rawDocs = rawDocsResults
      .filter((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Error loading ${filePaths[index]}: ${result.reason}`);
          return false;
        }
        return true;
      })
      .map(result => (result as PromiseFulfilledResult<Document>).value);
  
    console.log(rawDocs);


    return rawDocs;
  }

  throw new Error("No source");
}


export { getRawData }
