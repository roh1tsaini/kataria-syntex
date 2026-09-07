/**
 * bytes → base64, chunked at 0x8000: String.fromCharCode spread over a full
 * font file (400+ KB) overflows the stack, so every large-byte → base64
 * conversion in the app must chunk. Works in browsers, Electron and Workers.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
