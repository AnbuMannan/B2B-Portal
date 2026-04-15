import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly tagLength = 16;
  private readonly ivLength = 12; // GCM standard

  constructor(private configService: ConfigService) {
    const keyString = this.configService.get<string>('security.encryption.key') || process.env.ENCRYPTION_KEY;
    
    if (!keyString) {
      this.logger.error('ENCRYPTION_KEY not configured in environment');
      throw new Error('ENCRYPTION_KEY not configured in environment');
    }

    // Always derive a 32-byte key via SHA-256 so the key works regardless
    // of whether the raw string is ASCII-only or contains multi-byte characters.
    this.encryptionKey = crypto.createHash('sha256').update(keyString).digest();

    this.logger.log('✅ EncryptionService initialized with AES-256-GCM');
  }

  /**
   * Encrypt a single field (phone, email, Aadhaar, etc.)
   * 
   * Returns: base64 encoded string containing IV + ciphertext + authTag
   * Format: IV(12 bytes) + CIPHERTEXT + AUTH_TAG(16 bytes)
   */
  encryptField(plaintext: string): string {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext must be a non-empty string');
      }

      // Generate random IV (Initialization Vector)
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      // Encrypt the data
      let ciphertext = cipher.update(plaintext, 'utf8', 'binary');
      ciphertext += cipher.final('binary');

      // Get authentication tag (for GCM mode)
      const authTag = cipher.getAuthTag();

      // Combine: IV + ciphertext + authTag, encode as base64
      const encryptedBuffer = Buffer.concat([
        iv,
        Buffer.from(ciphertext, 'binary'),
        authTag,
      ]);

      const encrypted = encryptedBuffer.toString('base64');

      this.logger.debug(
        `Encrypted field: ${plaintext.substring(0, 3)}... → ${encrypted.substring(0, 20)}...`,
      );

      return encrypted;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error(`Encryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Decrypt a single field
   * 
   * Input: base64 encoded string (IV + ciphertext + authTag)
   * Returns: plaintext string
   */
  decryptField(encrypted: string): string {
    try {
      if (!encrypted || typeof encrypted !== 'string') {
        throw new Error('Encrypted field must be a non-empty string');
      }

      // Decode from base64
      const encryptedBuffer = Buffer.from(encrypted, 'base64');

      // Extract components
      const iv = encryptedBuffer.subarray(0, this.ivLength);
      const authTag = encryptedBuffer.subarray(
        encryptedBuffer.length - this.tagLength,
      );
      const ciphertext = encryptedBuffer.subarray(
        this.ivLength,
        encryptedBuffer.length - this.tagLength,
      );

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // Set the authentication tag for verification
      decipher.setAuthTag(authTag);

      // Decrypt
      let plaintext = decipher.update(ciphertext, undefined, 'utf8');
      plaintext += decipher.final('utf8');

      this.logger.debug(
        `Decrypted field: ${encrypted.substring(0, 20)}... → ${plaintext.substring(0, 3)}...`,
      );

      return plaintext;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Hash a sensitive field (one-way, for comparisons)
   * Used for PII fields that don't need to be decrypted
   */
  hashField(plaintext: string): string {
    return crypto
      .createHash('sha256')
      .update(plaintext + this.encryptionKey.toString('hex'))
      .digest('hex');
  }

  /**
   * Encrypt an entire object (multiple fields)
   * Useful for batch operations
   */
  encryptObject<T extends Record<string, any>>(
    obj: T,
    fieldsToEncrypt: (keyof T)[],
  ): T {
    const encrypted = { ...obj };

    fieldsToEncrypt.forEach((field) => {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encryptField(encrypted[field]) as any;
      }
    });

    return encrypted;
  }

  /**
   * Decrypt an entire object
   */
  decryptObject<T extends Record<string, any>>(
    obj: T,
    fieldsToDecrypt: (keyof T)[],
  ): T {
    const decrypted = { ...obj };

    fieldsToDecrypt.forEach((field) => {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = this.decryptField(decrypted[field]) as any;
        } catch (error) {
          this.logger.warn(`Failed to decrypt field ${String(field)}: ${(error as Error).message}`);
          // Don't crash, leave field as-is
        }
      }
    });

    return decrypted;
  }
}
