export async function isSudo(cookies: string): Promise<boolean> {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/sudoCookie`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
  });
  const data = await response.json();
  console.log("Sudo Cookie Value: ", data.sudoCookieValue);
  return !!data.sudoCookieValue;
}
