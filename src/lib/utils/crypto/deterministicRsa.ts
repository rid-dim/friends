import forge from 'node-forge';

function bytesToForgeBytes(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return s;
}

async function sha256Bytes(message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

function createDeterministicPrng(seed: Uint8Array) {
  const prng = forge.random.createInstance();
  let counter = 0;

  // Refill function used by forge to get entropy
  prng.seedFileSync = (needed: number) => {
    const out = forge.util.createBuffer();
    while (out.length() < needed) {
      // HMAC-SHA256(seed, counter)
      const hmac = forge.hmac.create();
      hmac.start('sha256', bytesToForgeBytes(seed));
      const ctr = new Uint8Array(4);
      new DataView(ctr.buffer).setUint32(0, counter++, false);
      hmac.update(bytesToForgeBytes(ctr));
      out.putBuffer(hmac.digest());
    }
    return out.getBytes(needed);
  };

  return prng;
}

export async function deriveDeterministicRsaFromScratchpadAddress(
  scratchpadAddress: string,
  bits: number = 2048
): Promise<{ privateKeyPem: string; publicKeyPem: string }> {
  if (!scratchpadAddress) {
    throw new Error('Scratchpad address required for deterministic RSA derivation');
  }

  // Seed derived only from address (as requested). No extra secret.
  const seed = await sha256Bytes(scratchpadAddress);
  const prng = createDeterministicPrng(seed);

  const keyPair = forge.pki.rsa.generateKeyPair({
    bits,
    e: 0x10001,
    prng,
    algorithm: 'PRIMEINC'
  });

  // Export private key as PKCS#8 (BEGIN PRIVATE KEY) for WebCrypto import
  const rsaPrivateAsn1 = forge.pki.privateKeyToAsn1(keyPair.privateKey);
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateAsn1);
  const privateKeyPem = forge.pki.privateKeyInfoToPem(privateKeyInfo);
  // Public key as SPKI (BEGIN PUBLIC KEY)
  const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);

  console.log('[deterministicRsa] derived from address', scratchpadAddress.slice(0, 8) + '...', 'pubLen=', publicKeyPem.length);

  return { privateKeyPem, publicKeyPem };
}


