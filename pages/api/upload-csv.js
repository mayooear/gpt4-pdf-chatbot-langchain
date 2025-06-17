import { IncomingForm } from 'formidable';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { upsertProducts, upsertMetaAds } from '../../lib/db';
import { getProductEmbedding } from '../../lib/openai';
import { upsertProductVector } from '../../lib/vector';

// Disable Next.js body parsing for this route, as formidable will handle it
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = new IncomingForm({
    // keepExtensions: true, // Not saving files, so not strictly necessary
    // uploadDir: '/tmp', // Not saving files
    // formidable options to avoid saving to disk, process in memory
    maxFileSize: 100 * 1024 * 1024, // 100MB limit for example
    filter: function ({ name, originalFilename, mimetype }) {
      // keep only csv files
      return mimetype && mimetype.includes('csv');
    }
  });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Formidable parsing error:', err);
          return reject(err);
        }
        resolve({ fields, files });
      });
    });

    const file = files.file?.[0]; // formidable nests files in arrays
    const uploadType = fields.type?.[0]; // fields are also in arrays

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    if (!uploadType) {
      return res.status(400).json({ message: 'Upload type not specified.' });
    }

    const records = [];
    // Create a readable stream from the buffer formidable provides if file is small
    // or from the file stream if formidable is configured to stream
    const fileStream = Readable.from(file.filepath ? require('fs').createReadStream(file.filepath) : Buffer.from(require('fs').readFileSync(file.path))); // file.path is deprecated, use file.filepath
                                                                                                                                                                // Actually, formidable v3 gives a `File` object. Its `filepath` is where it's temporarily stored.
                                                                                                                                                                // To avoid disk writes entirely with formidable, you'd need to pipe `part` streams directly.
                                                                                                                                                                // For now, this assumes formidable might write a temp file, which is common.
                                                                                                                                                                // A more advanced setup for zero disk IO would involve directly piping part streams in formidable's 'part' event.

    const parser = fileStream.pipe(
      parse({
        columns: true, // Output rows as objects
        skip_empty_lines: true,
        trim: true,
        // autoParse: true, // Be careful with autoParse, especially for dates and numbers if format is tricky
        // cast: true, // More robust casting
        cast: (value, context) => {
          if (context.header) return value; // Do not cast headers
          // Example casting for known numeric fields (adjust based on actual CSV headers)
          if (['impressions', 'clicks', 'leads'].includes(context.column)) {
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
          }
          if (['spend'].includes(context.column)) {
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
          }
          // Example for dates if not automatically parsed by `date: true` or if specific format
          if (context.column === 'date' && value) {
             // Basic ISO 8601 date check, adjust if CSV has different format
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return new Date(value);
            }
            // Try to parse common date formats if needed, or ensure CSV is standardized
            const d = new Date(value);
            return d instanceof Date && !isNaN(d) ? d : value;
          }
          // Claims and nutrition_info might be JSON strings in CSV
          if (['claims', 'nutrition_info'].includes(context.column) && value) {
            try {
              return JSON.parse(value);
            } catch (e) {
              // console.warn(`Failed to parse JSON for column ${context.column}: ${value}`);
              return value; // Return as string if not valid JSON
            }
          }
          return value;
        },
      })
    );

    for await (const record of parser) {
      records.push(record);
    }

    // Clean up temp file if formidable created one
    if (file.filepath && require('fs').existsSync(file.filepath)) {
        require('fs').unlinkSync(file.filepath);
    }

    let result;
    let embeddingErrors = [];
    if (uploadType === 'products') {
      result = await upsertProducts(records);
      if (!result.error && result.data && result.data.length > 0) {
        console.log(`Successfully upserted ${result.data.length} products to relational DB. Starting embedding generation...`);
        // Asynchronously generate embeddings and upsert to vector DB
        // For now, sequential processing. For large datasets, consider a job queue.
        const embeddingPromises = result.data.map(async (product) => {
          try {
            // Ensure product object has necessary fields (name, description, claims)
            // The product object from upsertProducts should contain the full row.
            const embedding = await getProductEmbedding(product);
            if (embedding) {
              // Product ID from the database (result.data[x].id) is crucial here
              await upsertProductVector(product.id, embedding, {
                name: product.name,
                description: product.description // Add any other metadata you want in Pinecone
              });
            } else {
              console.warn(`No embedding generated for product ${product.id}, skipping vector DB upsert.`);
              embeddingErrors.push({ productId: product.id, error: "Embedding generation returned null." });
            }
          } catch (embeddingError) {
            console.error(`Failed to generate/upsert embedding for product ${product.id}:`, embeddingError);
            embeddingErrors.push({ productId: product.id, error: embeddingError.message });
          }
        });
        await Promise.all(embeddingPromises); // Wait for all embedding processes to complete
        if (embeddingErrors.length > 0) {
          console.warn("Some products had embedding errors:", embeddingErrors);
          // Not returning these errors to client for now to keep success message focused on DB insert,
          // but this could be changed to include a partial success/warning.
        }
      } else if (result.error) {
        console.error("Error upserting products to relational DB:", result.error);
        // Error already handled below
      } else {
        console.log("No product data returned from upsertProducts or no data to process for embeddings.");
      }
    } else if (uploadType === 'metaAds') {
      result = await upsertMetaAds(records);
    } else {
      return res.status(400).json({ message: 'Invalid upload type.' });
    }

    if (result.error) {
      console.error(`Database upsert error for ${uploadType}:`, result.error);
      return res.status(500).json({ message: `Database error: ${result.error.message}` });
    }

    let responseMessage = `${uploadType} data uploaded and processed successfully.`;
    if (embeddingErrors.length > 0) {
      responseMessage += ` Some products had embedding generation/upsert errors: ${embeddingErrors.length} errors. Check server logs.`;
    }

    return res.status(200).json({
      message: responseMessage,
      processedCount: records.length,
      insertedCount: result.data?.length || 0, // This is count from relational DB
      embeddingErrors: embeddingErrors, // Optionally send error details to client
    });

  } catch (error) {
    console.error('Error in upload-csv handler:', error);
    // Clean up temp file in case of error too
    // This part is tricky because `file` might not be defined if formidable.parse itself failed early.
    // const file = error.field?.file?.[0] || (form.parsedFields?.file?.[0]); // Attempt to get file if possible
    // if (file?.filepath && require('fs').existsSync(file.filepath)) {
    //     require('fs').unlinkSync(file.filepath);
    // }
    return res.status(500).json({ message: error.message || 'An unknown error occurred during file upload.' });
  }
}
