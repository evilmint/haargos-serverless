import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const sharedKey = createHash('sha256')
  .update(String(process.env.CRYPTO_KEY))
  .digest('base64')
  .slice(0, 32);

function encryptData(data: any, key: string) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(key, 'utf-8'), iv);
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const encryptedData = Buffer.concat([iv, encrypted]);
  return encryptedData.toString('base64');
}

function decryptData(data: any, key: string) {
  const buffer = Buffer.from(data, 'base64');
  const iv = buffer.subarray(0, 16);
  const encryptedData = buffer.subarray(16);
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(key, 'utf-8'), iv);
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString());
}

function decrypt(data: any) {
  return decryptData(data, sharedKey);
}

function encrypt(data: any) {
  return encryptData(data, sharedKey);
}

export { encrypt, decrypt };
