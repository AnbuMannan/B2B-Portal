import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';

// IEC: 10 alphanumeric characters issued by DGFT
const IEC_REGEX = /^[A-Z0-9]{10}$/;

export interface IecVerificationResult {
  valid: boolean;
  iec?: string;
  error?: string;
}

@Injectable()
export class IecService {
  private readonly logger = new Logger(IecService.name);

  constructor(private readonly prisma: PrismaService) {}

  validateFormat(iec: string): boolean {
    return IEC_REGEX.test(iec?.toUpperCase());
  }

  async verify(iec: string, userId?: string): Promise<IecVerificationResult> {
    const normalized = iec?.toUpperCase().trim();

    if (!this.validateFormat(normalized)) {
      return {
        valid: false,
        error: 'Invalid IEC format. Must be 10 alphanumeric characters issued by DGFT',
      };
    }

    // In production: call DGFT API
    // https://www.dgft.gov.in/CP/?opt=iecsearch
    this.logger.debug(`IEC format validated: ${normalized}`);

    const result: IecVerificationResult = { valid: true, iec: normalized };

    this.prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        entityType: 'IEC_VERIFICATION',
        entityId: normalized,
        action: 'CREATE',
        newValue: result as any,
      },
    }).catch((err) => this.logger.warn(`IEC audit log failed: ${err.message}`));

    return result;
  }
}
