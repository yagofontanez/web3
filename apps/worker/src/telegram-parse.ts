export function parseStart(text: string | undefined, botUsername: string) {
  if (!text) return null;
  const match = text.trim().match(/^\/start(?:@(\w+))?\s+([A-Za-z0-9_-]{8,64})$/);
  if (!match) return null;
  if (match[1] && match[1].toLowerCase() !== botUsername.toLowerCase()) return null;
  return match[2]!;
}
