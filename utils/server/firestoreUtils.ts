import { getEnvName } from '@/utils/env';

export const getChatLogsCollectionName = () => {
  const env = getEnvName();
  return `${env}_chatLogs`;
};
