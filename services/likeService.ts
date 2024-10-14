import axios from 'axios';

export const checkUserLikes = async (
  answerIds: string[],
  uuid: string,
): Promise<Record<string, boolean>> => {
  try {
    // Make a POST request to the like API route with the answer IDs and user UUID
    const response = await axios.post('/api/like?action=check', {
      answerIds,
      uuid,
    });
    return response.data;
  } catch (error) {
    console.error('Error checking likes:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Server response:', error.response.data);
      throw new Error(
        error.response.data.message ||
          'An error occurred while checking likes.',
      );
    }
    throw new Error('An error occurred while checking likes.');
  }
};

export const getLikeCounts = async (
  answerIds: string[],
): Promise<Record<string, number>> => {
  try {
    const response = await axios.post('/api/like?action=counts', { answerIds });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error ||
          'An error occurred while fetching like counts.',
      );
    }
    throw new Error('An error occurred while fetching like counts.');
  }
};

export const updateLike = async (
  answerId: string,
  uuid: string,
  like: boolean,
): Promise<void> => {
  try {
    const response = await axios.post('/api/like', { answerId, uuid, like });
    if (response.status !== 200) {
      throw new Error(response.data.message || 'Failed to update like status.');
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.message ||
          'An error occurred while updating like status.',
      );
    }
    throw new Error('An error occurred while updating like status.');
  }
};
