type RandomSource = {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
};

// randomUUID is restricted to secure origins. getRandomValues also works on HTTP LAN URLs.
export function clientId(source: RandomSource = globalThis.crypto): string {
  if (source.randomUUID) return source.randomUUID();
  if (!source.getRandomValues) throw new Error('This browser does not support secure random IDs. Please use a current browser.');
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
