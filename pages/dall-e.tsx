import { useState } from 'react';
import styles from '@/styles/dall-e.module.css';

const DallE = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrls, setImageUrls] = useState([] as any[]);
  const [isLoading, setIsLoading] = useState(false);

  const generateImage = async () => {
    setIsLoading(true);
    const res = await fetch('/api/generateImage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    console.log(data);
    setImageUrls(data.imageUrls);
    setIsLoading(false);
  };

  return (
    <div className={styles['dall-e-container']}>
      <div className={styles['input-container']}>
        <input
          type="text"
          placeholder="Enter a prompt"
          className={styles['input-prompt']}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          onClick={generateImage}
          className={styles['generate-button']}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Generate Image'}
        </button>
      </div>
      <div className={styles['image-container']}>
        {imageUrls.map((imageUrl, index) => (
          <div key={index}>
            <img
              src={imageUrl.url}
              alt={`Generated Image ${index}`}
              className={styles['generated-image']}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DallE;
