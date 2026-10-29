import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SYMBOLS = "!@#$%*?";

/** Cryptographically random temporary password (no ambiguous characters), 16 characters. */
export function generateTemporaryPassword(length = 16) {
  const chars = Array.from({ length: length - 2 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  chars.push(SYMBOLS[randomInt(SYMBOLS.length)], String(randomInt(10)));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
