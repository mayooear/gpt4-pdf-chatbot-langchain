import axios from 'axios';

export const checkUserLikes = async (answerIds: string[], uuid: string): Promise<Record<string, boolean>> => {
  try {
    // Make a POST request to the like API route with the answer IDs and user UUID
    const response = await axios.post('/api/like?action=check', { answerIds, uuid });
    return response.data;
  } catch (error) {
    console.error('Error fetching like statuses:', error);
    throw error; 
  }
};

export const getLikeCounts = async (answerIds: string[]): Promise<Record<string, number>> => {
    try {
      const response = await axios.post('/api/like?action=counts', { answerIds });
      return response.data;
    } catch (error) {
      console.error('Error fetching like counts:', error);
      throw error;
    }
  };
