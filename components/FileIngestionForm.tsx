import React, { useEffect, useState } from 'react';

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
    console.log('onIngestClick... file is:', file)
    if (!file) {
      alert('Please select a PDF file to ingest.');
      return;
    }

    try {
        setLoading(true)
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = async () => {
      const base64File = fileReader.result?.toString().split(',')[1];
      console.log('base64 is ready...')
        // console.log('base64:', base64File)
        const response = await fetch('/api/ingest-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64File, fileName: file.name }),
        });

        if (response.ok) {
          localStorage.setItem('currFileName', file.name);
          alert('Ingestion complete.');
          if (onFileIngested) {
            onFileIngested(file.name);
          }
          setLoading(false)
        } else {
            console.log(response)
          alert('Failed to ingest the file. Please try again.');
          setLoading(false)
        }
      };
    } catch (error) {
      setLoading(false)
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