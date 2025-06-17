import React, { useState, useEffect } from 'react';
import withAdminAuth from '../../components/auth/withAdminAuth';
import Layout from '../../components/layout';

const initialFormState = {
  pineconeIndexName: '', // Example non-sensitive setting
  defaultItemsPerPage: 10, // Another example
  // Add other non-sensitive settings here
};

// Define which keys from the fetched settings are considered non-sensitive and editable
const editableSettingsKeys = ['pineconeIndexName', 'defaultItemsPerPage'];

function AdminSettingsPageContent() {
  const [settings, setSettings] = useState(initialFormState);
  const [apiKeyStatuses, setApiKeyStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch settings');
      }
      const data = await response.json();

      const editableData = {};
      const statuses = data.apiKeyStatuses || {};

      for (const key of editableSettingsKeys) {
        if (data[key] !== undefined) {
          editableData[key] = data[key];
        }
      }

      setSettings(prev => ({ ...prev, ...editableData }));
      setApiKeyStatuses(statuses);
      setMessage({ type: 'success', content: 'Settings loaded.' });
    } catch (error) {
      console.error("Error fetching settings:", error);
      setMessage({ type: 'error', content: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) : value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', content: '' });

    // Prepare only the editable settings for saving
    const settingsToSave = {};
    for (const key of editableSettingsKeys) {
      if (settings[key] !== undefined) {
        settingsToSave[key] = settings[key];
      }
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settingsToUpdate: settingsToSave }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to save settings');
      }
      setMessage({ type: 'success', content: 'Settings saved successfully!' });
      // Optionally re-fetch settings or update state based on response
      if (result.updated) {
         const updatedEditableData = {};
         result.updated.forEach(item => {
            if (editableSettingsKeys.includes(item.key)) {
                 updatedEditableData[item.key] = item.value;
            }
         });
         setSettings(prev => ({ ...prev, ...updatedEditableData }));
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: 'error', content: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h1>Admin Settings</h1>
      {message.content && (
        <p style={{ color: message.type === 'error' ? 'red' : 'green' }}>
          {message.content}
        </p>
      )}

      {isLoading ? (
        <p>Loading settings...</p>
      ) : (
        <>
          <section style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #eee' }}>
            <h2>API Key Statuses</h2>
            <ul>
              {Object.entries(apiKeyStatuses).map(([key, status]) => (
                <li key={key}>
                  <strong>{key.replace(/_/g, ' ')}:</strong> {status}
                </li>
              ))}
            </ul>
            <p><small>Sensitive API keys are managed via environment variables on the server (e.g., in Vercel).</small></p>
          </section>

          <form onSubmit={handleSubmit}>
            <section style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #eee' }}>
              <h2>Application Settings</h2>
              <p><small>These settings are stored in the database.</small></p>

              <div>
                <label htmlFor="pineconeIndexName">Pinecone Index Name (Example):</label>
                <input
                  type="text"
                  id="pineconeIndexName"
                  name="pineconeIndexName"
                  value={settings.pineconeIndexName || ''}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                 <small> Note: Actual Pinecone index name usage is often direct from env var in `lib/vector.js` for critical operations.</small>
              </div>

              <div style={{marginTop: '1rem'}}>
                <label htmlFor="defaultItemsPerPage">Default Items Per Page (Example):</label>
                <input
                  type="number"
                  id="defaultItemsPerPage"
                  name="defaultItemsPerPage"
                  value={settings.defaultItemsPerPage || 10}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
              </div>
              {/* Add more editable settings here, matching `editableSettingsKeys` */}

              <button type="submit" disabled={isSaving || isLoading} style={{marginTop: '1rem'}}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </section>
          </form>
        </>
      )}
    </div>
  );
}

const ProtectedAdminSettingsPage = () => {
  return (
    <Layout>
      <AdminSettingsPageContent />
    </Layout>
  );
};

export default withAdminAuth(ProtectedAdminSettingsPage);
