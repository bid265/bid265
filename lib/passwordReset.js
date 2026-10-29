import { createHash, randomBytes } from "node:crypto";

export const RESET_TOKEN_TTL_MINUTES = 60;

export function createResetToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}
