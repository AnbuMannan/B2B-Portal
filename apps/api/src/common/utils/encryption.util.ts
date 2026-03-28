import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../database/encryption.service';

/**
 * Utility functions for field encryption/decryption
 * Simplifies usage in services
 */
@Injectable()
export class EncryptionUtil {
  constructor(private encryptionService: EncryptionService) {}

  /**
   * Encrypt phone number
   */
  encryptPhone(phone: string): string {
    return this.encryptionService.encryptField(phone);
  }

  decryptPhone(encrypted: string): string {
    return this.encryptionService.decryptField(encrypted);
  }

  /**
   * Encrypt email
   */
  encryptEmail(email: string): string {
    return this.encryptionService.encryptField(email);
  }

  decryptEmail(encrypted: string): string {
    return this.encryptionService.decryptField(encrypted);
  }

  /**
   * Encrypt Aadhaar (masked format)
   */
  encryptAadhaar(aadhaar: string): string {
    return this.encryptionService.encryptField(aadhaar);
  }

  decryptAadhaar(encrypted: string): string {
    return this.encryptionService.decryptField(encrypted);
  }

  /**
   * Bulk encrypt LeadContactReveal
   */
  encryptLeadContact(contact: {
    buyerPhoneNumber: string;
    buyerEmail: string;
    buyerWhatsapp: string;
  }): {
    buyerPhoneNumber: string;
    buyerEmail: string;
    buyerWhatsapp: string;
  } {
    return {
      buyerPhoneNumber: this.encryptPhone(contact.buyerPhoneNumber),
      buyerEmail: this.encryptEmail(contact.buyerEmail),
      buyerWhatsapp: this.encryptPhone(contact.buyerWhatsapp),
    };
  }

  /**
   * Bulk decrypt LeadContactReveal
   */
  decryptLeadContact(contact: {
    buyerPhoneNumber: string;
    buyerEmail: string;
    buyerWhatsapp: string;
  }): {
    buyerPhoneNumber: string;
    buyerEmail: string;
    buyerWhatsapp: string;
  } {
    return {
      buyerPhoneNumber: this.decryptPhone(contact.buyerPhoneNumber),
      buyerEmail: this.decryptEmail(contact.buyerEmail),
      buyerWhatsapp: this.decryptPhone(contact.buyerWhatsapp),
    };
  }
}
