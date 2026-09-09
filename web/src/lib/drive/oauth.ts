import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { google } from "googleapis";

function secret(name: string) { const value = process.env[name]; if (!value) throw new Error(`${name} no está configurado.`); return value; }
export function createGoogleOAuthClient() { return new google.auth.OAuth2(secret("GOOGLE_CLIENT_ID"), secret("GOOGLE_CLIENT_SECRET"), secret("GOOGLE_REDIRECT_URI")); }
export function signOAuthState(userId: string) { const signature = createHmac("sha256", secret("GOOGLE_TOKEN_ENCRYPTION_KEY")).update(userId).digest("hex"); return Buffer.from(`${userId}.${signature}`).toString("base64url"); }
export function verifyOAuthState(state: string) { const decoded = Buffer.from(state, "base64url").toString(); const [userId, signature] = decoded.split("."); if (!userId || signOAuthState(userId) !== state || !signature) throw new Error("Estado OAuth inválido."); return userId; }
export function encryptTokens(tokens: unknown) { const key = Buffer.from(secret("GOOGLE_TOKEN_ENCRYPTION_KEY"), "base64"); if (key.length !== 32) throw new Error("La clave de cifrado debe contener 32 bytes en base64."); const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens)), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"); }
export function decryptTokens(payload: string) { const key = Buffer.from(secret("GOOGLE_TOKEN_ENCRYPTION_KEY"), "base64"); const data = Buffer.from(payload, "base64"); const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString()); }
