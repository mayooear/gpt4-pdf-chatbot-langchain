import React, { useState } from 'react';
import withAdminAuth from '../../components/auth/withAdminAuth';
import Layout from '../../components/layout';

function UploadPageContent() {
  const [productFile, setProductFile] = useState(null);
  const [adsFile, setAdsFile] = useState(null);
  const [isUploadingProducts, setIsUploadingProducts] = useState(false);
  const [isUploadingAds, setIsUploadingAds] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ products: '', ads: '' });

  const handleFileChange = (setter) => (event) => {
    setter(event.target.files[0]);
  };

  const handleSubmit = async (file, type, setLoading, setStatusKey) => {
    if (!file) {
      setUploadStatus(prev => ({ ...prev, [setStatusKey]: 'Please select a file first.' }));
      return;
    }

    setLoading(true);
    setUploadStatus(prev => ({ ...prev, [setStatusKey]: 'Uploading...' }));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type); // To distinguish on the backend

    try {
      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
        // Headers are not explicitly set for 'multipart/form-data' with FormData,
        // the browser will set it correctly including the boundary.
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus(prev => ({ ...prev, [setStatusKey]: `Success: ${result.message} (${result.processedCount} records)` }));
      } else {
        setUploadStatus(prev => ({ ...prev, [setStatusKey]: `Error: ${result.message}` }));
      }
    } catch (error) {
      console.error(`Error uploading ${type} CSV:`, error);
      setUploadStatus(prev => ({ ...prev, [setStatusKey]: `Error: ${error.message || 'Upload failed'}` }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Admin Upload Page</h1>
      <p>This page is protected and only accessible by users with the 'Admin' role.</p>

      <section style={{ marginTop: '2rem', marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Upload Products CSV</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(productFile, 'products', setIsUploadingProducts, 'products');
          }}
          encType="multipart/form-data"
        >
          <div>
            <label htmlFor="product-csv">Products CSV File:</label>
            <input
              type="file"
              id="product-csv"
              name="product-csv"
              accept=".csv"
              onChange={handleFileChange(setProductFile)}
              disabled={isUploadingProducts}
            />
          </div>
          <button type="submit" disabled={isUploadingProducts || !productFile} style={{ marginTop: '0.5rem' }}>
            {isUploadingProducts ? 'Uploading...' : 'Upload Products'}
          </button>
          {uploadStatus.products && <p>{uploadStatus.products}</p>}
        </form>
      </section>

      <section style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Upload Meta Ads CSV</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(adsFile, 'metaAds', setIsUploadingAds, 'ads');
          }}
          encType="multipart/form-data"
        >
          <div>
            <label htmlFor="meta-ads-csv">Meta Ads CSV File:</label>
            <input
              type="file"
              id="meta-ads-csv"
              name="meta-ads-csv"
              accept=".csv"
              onChange={handleFileChange(setAdsFile)}
              disabled={isUploadingAds}
            />
          </div>
          <button type="submit" disabled={isUploadingAds || !adsFile} style={{ marginTop: '0.5rem' }}>
            {isUploadingAds ? 'Uploading...' : 'Upload Meta Ads'}
          </button>
          {uploadStatus.ads && <p>{uploadStatus.ads}</p>}
        </form>
      </section>
    </div>
  );
}

const ProtectedUploadPage = () => {
  return (
    <Layout>
      <UploadPageContent />
    </Layout>
  );
};

export default withAdminAuth(ProtectedUploadPage);
