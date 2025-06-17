import { getServerSession } from 'next-auth/next';
import authOptions from './auth/[...nextauth]'; // Ensure this path is correct
import { getAllAppSettings, updateAppSettings } from '../../lib/db';

// Helper function to check admin role from session
const isAdmin = (session) => {
  return session && session.user && session.user.role === 'Admin';
};

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (req.method === 'GET') {
    // For GET, we can decide if all users can see settings or only admins
    // For now, let's assume only admins can see all DB settings,
    // but we will also add environment variable statuses which might be less sensitive.
    // if (!isAdmin(session)) {
    //   return res.status(403).json({ message: 'Forbidden: You do not have permission to view settings.' });
    // }

    let dbSettings = {};
    try {
      // Fetch non-sensitive settings from DB if needed by non-admins, or all by admins
      // For this example, only admins will fetch from DB for simplicity in this step
      if (isAdmin(session)) {
        const { data, error } = await getAllAppSettings();
        if (error) {
          throw new Error(`Failed to fetch database settings: ${error.message}`);
        }
        dbSettings = data || {};
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Don't return DB error details to client if not admin or if it's sensitive
      if (isAdmin(session)) {
        return res.status(500).json({ message: error.message || 'Failed to fetch settings.' });
      }
      // For non-admins, we might only return env var statuses and not error out here
    }

    // Status of environment-variable-based API keys
    const apiKeyStatuses = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Configured' : 'Not Set',
      PINECONE_API_KEY: process.env.PINECONE_API_KEY ? 'Configured' : 'Not Set',
      PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT ? 'Configured' : 'Not Set',
      PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME ? 'Configured' : 'Not Set',
      // Add other keys as needed
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'Configured' : 'Not Set',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Not Set',
      SUPABASE_URL: process.env.SUPABASE_URL ? 'Configured' : 'Not Set', // For info
    };

    // Combine DB settings (for admins) and API key statuses
    const responseSettings = isAdmin(session)
      ? { ...dbSettings, apiKeyStatuses }
      : { apiKeyStatuses }; // Non-admins only see API key statuses

    return res.status(200).json(responseSettings);

  } else if (req.method === 'POST') {
    if (!isAdmin(session)) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to update settings.' });
    }

    const { settingsToUpdate } = req.body; // Expects an object like { settingKey: 'newValue', ... }

    if (!settingsToUpdate || typeof settingsToUpdate !== 'object' || Object.keys(settingsToUpdate).length === 0) {
      return res.status(400).json({ message: 'No settings provided to update or invalid format.' });
    }

    // Filter out apiKeyStatuses from being saved to DB if they are accidentally sent
    const filteredSettings = { ...settingsToUpdate };
    delete filteredSettings.apiKeyStatuses;
    // Potentially add more logic here to prevent saving sensitive keys if their actual values are sent

    try {
      const { data, error } = await updateAppSettings(filteredSettings);
      if (error) {
        throw new Error(`Failed to update settings: ${error.message}`);
      }
      return res.status(200).json({ message: 'Settings updated successfully.', updated: data });
    } catch (error) {
      console.error('Error updating settings:', error);
      return res.status(500).json({ message: error.message || 'Failed to update settings.' });
    }

  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
