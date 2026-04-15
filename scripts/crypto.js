// ============================================================================
// CRYPTO UTILITIES — AES-GCM encryption for API key storage
// ============================================================================

const ENCRYPTION_KEY_STORAGE = '_encryptionKey';

async function getOrCreateEncryptionKey() {
  const result = await chrome.storage.local.get([ENCRYPTION_KEY_STORAGE]);
  if (result[ENCRYPTION_KEY_STORAGE]) {
    return await crypto.subtle.importKey(
      'jwk',
      result[ENCRYPTION_KEY_STORAGE],
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('jwk', key);
  await chrome.storage.local.set({ [ENCRYPTION_KEY_STORAGE]: exported });
  return key;
}

async function encryptValue(plaintext) {
  if (!plaintext) return null;

  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)))
  };
}

async function decryptValue(encrypted) {
  if (!encrypted || !encrypted.iv || !encrypted.ciphertext) return null;

  const key = await getOrCreateEncryptionKey();
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const cipherBuffer = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBuffer
  );

  return new TextDecoder().decode(decrypted);
}


if (typeof module !== 'undefined' && module.exports) {
  module.exports = { encryptValue, decryptValue, getOrCreateEncryptionKey };
}
