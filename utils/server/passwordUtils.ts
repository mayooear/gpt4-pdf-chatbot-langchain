export function getLastPasswordChangeTimestamp(): number {
  const timestamp = process.env.LAST_PASSWORD_CHANGE_TIMESTAMP;
  return timestamp ? parseInt(timestamp, 10) : 0;
}
export function isTokenValid(token: string): boolean {
  const [, timestampStr] = token.split(':');
  const tokenTimestamp = parseInt(timestampStr, 10);
  const lastPasswordChangeTimestamp = getLastPasswordChangeTimestamp();

  // Convert tokenTimestamp from milliseconds to seconds if necessary
  const tokenTimestampInSeconds =
    tokenTimestamp > 9999999999
      ? Math.floor(tokenTimestamp / 1000)
      : tokenTimestamp;

  return tokenTimestampInSeconds > lastPasswordChangeTimestamp;
}
