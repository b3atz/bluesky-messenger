// File: frontend/utils/encryption.ts

/**
 * Utility functions for handling end-to-end encryption for messages
 * Uses TweetNaCl.js for encryption
 */

// Define interfaces for our encryption types
export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface RawKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedMessage {
  nonce: string;
  message: string;
  publicKey: string;
}

// Module level variables for dynamic imports
let nacl: any;
let naclUtil: any;

// Dynamic imports to avoid SSR issues
const loadDependencies = async (): Promise<void> => {
  if (!nacl || !naclUtil) {
    nacl = (await import('tweetnacl')).default;
    naclUtil = await import('tweetnacl-util');
  }
};

/**
 * Generate a new encryption key pair for the user
 * @returns {Promise<KeyPair | null>} Object containing publicKey and secretKey as hex strings
 */
export const generateKeyPair = async (): Promise<KeyPair | null> => {
  try {
    await loadDependencies();
    const keypair = nacl.box.keyPair() as RawKeyPair;
    
    return {
      publicKey: Buffer.from(keypair.publicKey).toString('hex'),
      secretKey: Buffer.from(keypair.secretKey).toString('hex')
    };
  } catch (error) {
    console.error('Error generating keys:', error);
    return null;
  }
};

/**
 * Deserialize keys from hex strings to Uint8Array
 * @param {KeyPair} serializedKeys - Object with serialized keys
 * @returns {RawKeyPair} Key pair object with Uint8Array keys
 */
export const deserializeKeyPair = (serializedKeys: KeyPair): RawKeyPair => {
  return {
    publicKey: Buffer.from(serializedKeys.publicKey, 'hex'),
    secretKey: Buffer.from(serializedKeys.secretKey, 'hex'),
  };
};

/**
 * Initialize or get the user's encryption keys
 * @returns {Promise<KeyPair | null>} Serialized key pair or null if error
 */
export const initializeKeys = async (): Promise<KeyPair | null> => {
  try {
    // Check if keys already exist in localStorage
    const storedKeys = localStorage.getItem('encryption_keys');
    if (storedKeys) {
      return JSON.parse(storedKeys) as KeyPair;
    } else {
      // Generate new keys
      const newKeyPair = await generateKeyPair();
      if (newKeyPair) {
        localStorage.setItem('encryption_keys', JSON.stringify(newKeyPair));
        return newKeyPair;
      }
      return null;
    }
  } catch (error) {
    console.error('Error initializing keys:', error);
    return null;
  }
};

/**
 * Encrypt a message for a recipient
 * @param {string} message - The plain text message to encrypt
 * @param {string} recipientPublicKey - Recipient's public key (hex string)
 * @param {KeyPair} senderKeys - Sender's key pair (serialized)
 * @returns {Promise<EncryptedMessage | null>} Encrypted message object or null if error
 */
export const encryptMessage = async (
  message: string, 
  recipientPublicKey: string, 
  senderKeys: KeyPair
): Promise<EncryptedMessage | null> => {
  try {
    await loadDependencies();
    
    // Convert keys from hex strings to Uint8Array
    const senderKeyPair = deserializeKeyPair(senderKeys);
    const theirPublicKey = Buffer.from(recipientPublicKey, 'hex');
    
    // Generate a random nonce
    const nonce = nacl.randomBytes(24);
    
    // Convert message to Uint8Array
    const messageUint8 = naclUtil.decodeUTF8(message);
    
    // Encrypt
    const encryptedMessage = nacl.box(
      messageUint8,
      nonce,
      theirPublicKey,
      senderKeyPair.secretKey
    );
    
    // Return encrypted message with nonce and sender's public key
    return {
      nonce: Buffer.from(nonce).toString('hex'),
      message: Buffer.from(encryptedMessage).toString('hex'),
      publicKey: senderKeys.publicKey,
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

/**
 * Decrypt a message from a sender
 * @param {EncryptedMessage} encryptedData - The encrypted message object
 * @param {string} senderPublicKey - Sender's public key (hex string)
 * @param {KeyPair} recipientKeys - Recipient's key pair (serialized)
 * @returns {Promise<string | null>} Decrypted message or null if decryption fails
 */
export const decryptMessage = async (
  encryptedData: EncryptedMessage, 
  senderPublicKey: string, 
  recipientKeys: KeyPair
): Promise<string | null> => {
  try {
    await loadDependencies();
    
    // Convert keys and data from hex strings to Uint8Array
    const recipientKeyPair = deserializeKeyPair(recipientKeys);
    const theirPublicKey = Buffer.from(senderPublicKey, 'hex');
    const nonce = Buffer.from(encryptedData.nonce, 'hex');
    const message = Buffer.from(encryptedData.message, 'hex');
    
    // Decrypt
    const decrypted = nacl.box.open(
      message,
      nonce,
      theirPublicKey,
      recipientKeyPair.secretKey
    );
    
    if (!decrypted) return null;
    
    // Convert from Uint8Array to string
    return naclUtil.encodeUTF8(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Store a public key for a user
 * @param {string} did - The DID of the user
 * @param {string} publicKey - The public key (hex string)
 */
export const storePublicKey = (did: string, publicKey: string): void => {
  try {
    const keysMap = JSON.parse(localStorage.getItem('contact_public_keys') || '{}');
    keysMap[did] = publicKey;
    localStorage.setItem('contact_public_keys', JSON.stringify(keysMap));
  } catch (error) {
    console.error('Error storing public key:', error);
  }
};

/**
 * Get a stored public key for a user
 * @param {string} did - The DID of the user
 * @returns {string | null} The public key or null if not found
 */
export const getPublicKey = (did: string): string | null => {
  try {
    const keysMap = JSON.parse(localStorage.getItem('contact_public_keys') || '{}');
    return keysMap[did] || null;
  } catch (error) {
    console.error('Error getting public key:', error);
    return null;
  }
};

/**
 * Create a placeholder encrypted message for demo purposes
 * In a real app, this would be replaced with actual encryption
 * @param {string} message - The message to encrypt
 * @param {KeyPair} keyPair - The sender's key pair
 * @returns {EncryptedMessage} A simulated encrypted message
 */
export const createDemoEncryptedMessage = (message: string, keyPair: KeyPair): EncryptedMessage => {
  return {
    nonce: 'demo-nonce',
    message: Buffer.from(message).toString('base64'),
    publicKey: keyPair?.publicKey || '',
  };
};