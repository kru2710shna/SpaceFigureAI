import { base64codes } from './base64codes';

/*
3 bytes are encoded in 4 bytes of base64
11111122 22223333 33444444
We want to be the fastest possible, so we will use a lookup table to convert 12 bits to 2 bytes of base64
But in order still to avoid one operation we will create 2 of those lookup tables.
- One for 2222 11111122
- One for 3333 33444444
*/

// 2222 11111122
const base64codes1 = new Uint32Array(64 * 64);
for (let i = 0; i < 64; i++) {
  for (let j = 0; j < 64; j++) {
    const index = (i << 2) | ((j & 0x30) >> 4) | ((j & 0x0f) << 8);
    base64codes1[index] = base64codes[i] | (base64codes[j] << 8);
  }
}

// 3333 33444444 that we store on the bits 16->31 just to allow to make directly the OR with the previous value
const base64codes2 = new Uint32Array(64 * 64);
for (let i = 0; i < 64; i++) {
  for (let j = 0; j < 64; j++) {
    const index = (i << 6) | j;
    base64codes2[index] = (base64codes[i] << 16) | (base64codes[j] << 24);
  }
}

/**
 * Convert a Uint8Array containing bytes to a Uint8Array containing the base64 encoded values
 * @param input
 * @returns a Uint8Array containing the encoded bytes
 */

export function encodeFast(input: Uint8Array): Uint8Array {
  const output32 = new Uint32Array(Math.ceil(input.length / 3));
  let i, j;
  for (i = 2, j = 0; i < input.length; i += 3, j++) {
    output32[j] =
      base64codes1[input[i - 2] | ((input[i - 1] & 0xf0) << 4)] |
      base64codes2[input[i] | ((input[i - 1] & 0x0f) << 8)];
  }
  if (i === input.length + 1) {
    // 1 octet yet to write
    output32[j] =
      base64codes[input[i - 2] >> 2] |
      (base64codes[(input[i - 2] & 0x03) << 4] << 8) |
      (15677 << 16);
  }
  if (i === input.length) {
    // 2 octets yet to write
    output32[j] =
      base64codes[input[i - 2] >> 2] |
      (base64codes[((input[i - 2] & 0x03) << 4) | (input[i - 1] >> 4)] << 8) |
      (base64codes[(input[i - 1] & 0x0f) << 2] << 16) |
      (61 << 24);
  }
  const output8 = new Uint8Array(output32.buffer);
  return output8;
}
