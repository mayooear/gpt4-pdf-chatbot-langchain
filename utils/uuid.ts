import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';

export const getOrCreateUUID = (): string => {
  let uuid = Cookies.get('uuid');
  if (!uuid) {
    uuid = uuidv4();
    Cookies.set('uuid', uuid, { expires: 365 });
  }
  return uuid;
};
