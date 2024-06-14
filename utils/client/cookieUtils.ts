export async function isSudo(cookies: string): Promise<boolean> {
  const url = `/api/sudoCookie`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
  });
  const data = await response.json();
  return !!data.sudoCookieValue;
}
