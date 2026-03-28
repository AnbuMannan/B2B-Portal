import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';

@Injectable()
export class LeadContactService {
  constructor(
    private prisma: PrismaService,
    private encryptionUtil: EncryptionUtil,
  ) {}

  async createContactReveal(data: {
    sellerId: string;
    buyLeadId: string;
    buyerPhoneNumber: string;
    buyerEmail: string;
    buyerWhatsapp: string;
  }) {
    // Encrypt PII before saving to database
    const encrypted = this.encryptionUtil.encryptLeadContact({
      buyerPhoneNumber: data.buyerPhoneNumber,
      buyerEmail: data.buyerEmail,
      buyerWhatsapp: data.buyerWhatsapp,
    });

    // Save encrypted data
    const result = await this.prisma.leadContactReveal.create({
      data: {
        sellerId: data.sellerId,
        buyLeadId: data.buyLeadId,
        buyerPhoneNumber: encrypted.buyerPhoneNumber,
        buyerEmail: encrypted.buyerEmail,
        buyerWhatsapp: encrypted.buyerWhatsapp,
      },
    });

    return result;
  }

  async getContactReveal(id: string) {
    const data = await this.prisma.leadContactReveal.findUnique({
      where: { id },
    });

    if (!data) return null;

    // Decrypt PII when reading from database
    const decrypted = this.encryptionUtil.decryptLeadContact({
      buyerPhoneNumber: data.buyerPhoneNumber,
      buyerEmail: data.buyerEmail,
      buyerWhatsapp: data.buyerWhatsapp,
    });

    return {
      ...data,
      ...decrypted,
    };
  }
}
