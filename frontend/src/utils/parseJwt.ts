export function parseJwt(token: string) {
  const base64Payload = token.split(".")[1];
  return JSON.parse(atob(base64Payload));
}
