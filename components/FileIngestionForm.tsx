import React, { useEffect, useState } from 'react';
// import axios from 'axios';

interface FileIngestionFormProps {
  onFileIngested?: (fileName: string) => void;
}

const FileIngestionForm: React.FC<FileIngestionFormProps> = ({ onFileIngested }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [loading, setLoading] = useState(false);
  const [buttonText, setButtonText] = useState('Ingest/Upload File');

  useEffect(() => {
    const savedFileName = localStorage.getItem('currFileName');
    if (savedFileName) {
      setFileName(savedFileName);
    }
  }, []);

  useEffect(() => {
    setButtonText(fileName === localStorage.getItem('currFileName') ? 'Change File' : 'Ingest/Upload File');
  }, [fileName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name); // Update the file name state variable
    }
  };

  const onIngestClick = async () => {
    console.log('onIngestClick... file is:', file);
    if (!file) {
      alert('Please select a PDF file to ingest.');
      return;
    }
  
    try {
      setLoading(true);
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = async () => {
        const base64File = fileReader.result?.toString().split(',')[1];
        console.log('base64 is ready...');
  
        // Call the parse-pdf API
        const parseResponse = await fetch('/api/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64File }),
        });
  
        if (parseResponse.ok) {
          const { text } = await parseResponse.json();
          console.log('parsing done.')
          // Call the split-text API
          const splitResponse = await fetch('/api/split-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
  
          if (splitResponse.ok) {
            const { chunks } = await splitResponse.json();
            console.log('splitting done.')
            // Call the ingest-chunks API
            const embedResponse = await fetch('/api/embed-and-save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chunks, namespace: file.name }),
            });
  
            if (embedResponse.ok) {
              localStorage.setItem('currFileName', file.name);
              alert('Ingestion complete.');
              if (onFileIngested) {
                onFileIngested(file.name);
              }
              setLoading(false);
            } else {
              console.log(embedResponse);
              alert('Failed to ingest the file. Please try again.');
              setLoading(false);
            }
          } else {
            alert('Failed to split the text. Please try again.');
            setLoading(false);
          }
        } else {
          alert('Failed to parse the PDF file. Please try again.');
          setLoading(false);
        }
      };
    } catch (error) {
      setLoading(false);
      alert('Failed to ingest the file. Please try again.');
      console.error(error);
    }
  };

  return (
    <div>
      {/* <label htmlFor="file-upload" className="custom-file-upload">
        {fileName}
      </label> */}
      { !loading && <>
        <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        // style={{ display: 'none' }}
        id="file-upload"
      />
      <button style={{ borderWidth: '2px', borderBlockColor: 'black' }} onClick={onIngestClick}>{buttonText}</button>
      </>}
      { loading && <>
        Loading . . .
      </>}
    </div>
  );
};

export default FileIngestionForm;