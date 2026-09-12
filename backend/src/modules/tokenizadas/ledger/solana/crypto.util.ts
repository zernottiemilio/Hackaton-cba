import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM roundtrip para secretos del keypair custodial.
// Formato de salida: base64(iv):base64(tag):base64(ciphertext).
// La clave viene de WALLET_ENCRYPTION_KEY (64 hex chars = 32 bytes).

const ALG = 'aes-256-gcm';

const getKey = (encryptionKeyHex: string): Buffer => {
  const key = Buffer.from(encryptionKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `WALLET_ENCRYPTION_KEY debe ser 64 hex chars (32 bytes). Recibido: ${key.length}`,
    );
  }
  return key;
};

export const cifrar = (plaintext: Buffer, encryptionKeyHex: string): string => {
  const key = getKey(encryptionKeyHex);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
};

export const descifrar = (blob: string, encryptionKeyHex: string): Buffer => {
  const key = getKey(encryptionKeyHex);
  const [ivB64, tagB64, ctB64] = blob.split(':');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Formato de secret cifrado inválido');
  }
  const decipher = createDecipheriv(ALG, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
};
