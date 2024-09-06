import { getEnvName } from '@/utils/env';

export const getAnswersCollectionName = () => {
  const env = getEnvName();
  return `${env}_chatLogs`;
};
