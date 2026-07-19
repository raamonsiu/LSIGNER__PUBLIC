import { registerAs } from '@nestjs/config';
import * as crypto from 'crypto';

export default registerAs('signing', () => {
  const privateKeyB64 = process.env.DOCUMENT_SIGNING_PRIVATE_KEY;
  const publicKeyB64 = process.env.DOCUMENT_SIGNING_PUBLIC_KEY;

  if (!privateKeyB64 || !publicKeyB64) {
    const missing: string[] = [];
    if (!privateKeyB64) missing.push('DOCUMENT_SIGNING_PRIVATE_KEY');
    if (!publicKeyB64) missing.push('DOCUMENT_SIGNING_PUBLIC_KEY');
    throw new Error(
      `Document signing keys not configured. Missing: ${missing.join(', ')}. ` +
        "Generate keys: node -e \"const c=require('crypto');" +
        "const {privateKey,publicKey}=c.generateKeyPairSync('ed25519');" +
        "console.log('DOCUMENT_SIGNING_PRIVATE_KEY='+privateKey.export({type:'pkcs8',format:'der'}).toString('base64'));" +
        "console.log('DOCUMENT_SIGNING_PUBLIC_KEY='+publicKey.export({type:'spki',format:'der'}).toString('base64'))\"",
    );
  }

  const privateKeyDer = Buffer.from(privateKeyB64, 'base64');
  const publicKeyDer = Buffer.from(publicKeyB64, 'base64');

  const privateKey = crypto.createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8',
  });
  const publicKey = crypto.createPublicKey({
    key: publicKeyDer,
    format: 'der',
    type: 'spki',
  });

  const fingerprint = crypto
    .createHash('sha256')
    .update(publicKeyDer)
    .digest('hex');

  // Raw 32-byte Ed25519 public key as hex (for external verification tools)
  const publicKeyRaw = publicKey.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI DER = 30 2A 30 05 06 03 2B 65 70 03 21 00 + 32 raw bytes
  // The raw key starts at byte 12
  const publicKeyHex = publicKeyRaw.subarray(12).toString('hex');

  return {
    privateKey,
    publicKey,
    publicKeyHex,
    fingerprint,
    keyVersion: 1,
  };
});
