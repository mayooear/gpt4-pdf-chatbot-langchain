import { isDevelopment } from '@/utils/env';

export const getChatLogsCollectionName = () => {
  const env = isDevelopment() ? 'dev' : 'prod';
  return `${env}_chatLogs`;
};
