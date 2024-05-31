import Cookies from 'js-cookie';

export async function isSudo(): Promise<boolean> {
  const response = await fetch('/api/sudoCookie', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  return !!data.sudoCookieValue;
}
