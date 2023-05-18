import { Document } from 'langchain/document';
import { readFile } from 'fs/promises';
import { BaseDocumentLoader } from 'langchain/document_loaders';
import xlsx from "xlsx";

export abstract class BufferLoader extends BaseDocumentLoader {
  constructor(public filePathOrBlob: string | Blob) {
    super();
  }

  protected abstract parse(
    raw: Buffer,
    metadata: Document['metadata'],
  ): Promise<Document[]>;

  public async load(): Promise<Document[]> {
    let buffer: Buffer;
    let metadata: Record<string, string>;
    if (typeof this.filePathOrBlob === 'string') {
      buffer = await readFile(this.filePathOrBlob);
      metadata = { source: this.filePathOrBlob };
    } else {
      buffer = await this.filePathOrBlob
        .arrayBuffer()
        .then((ab) => Buffer.from(ab));
      metadata = { source: 'blob', blobType: this.filePathOrBlob.type };
    }
    return this.parse(buffer, metadata);
  }
}

export class CustomExcelLoader extends BufferLoader {
  public async parse(
    raw: Buffer,
    metadata: Document['metadata'],
  ): Promise<Document[]> {
    const parsed = await xlsx.read(raw, { type: 'buffer' });
    const sheet_data = sheetData(parsed);
    const data = split_in_to_doc(sheet_data , metadata);
    return data;
  }
}

export const sheetData = (parsed : xlsx.WorkBook) =>{
  let data : Array<Object> = [];
  parsed.SheetNames.forEach((name) => {
    const sheet = parsed.Sheets[name];
    const sheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 , raw: false });
    const headerRow = sheetData[0];
    sheetData.shift();
    data.push({headerRow , sheetData , sheetName : name})
  });
  return data;
}
export const split_in_to_doc = (data  : Array<Object> , metadata : Object) => {
  let docs : Array<Document> = []
  data.forEach((sheet : any) => {
    let sheetData = sheet.sheetData.map((row : any) => row.join(",")).join("\n");
    let doc = new Document({
      pageContent: sheetData,
      
      metadata: {
        ...metadata,
        CSV_Headers : sheet.headerRow.join(","),
        sheetName : sheet.sheetName
      },
    });
    docs.push(doc)
  })
  return docs
}
