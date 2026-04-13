import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/database.service';

// PAN format: 5 uppercase letters + 4 digits + 1 uppercase letter
// Example: ABCDE1234F
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export interface PanVerificationResult {
  valid: boolean;
  pan?: string;
  panType?: string; // P=Person, C=Company, H=HUF, F=Firm, A=AOP, B=BOI, G=Govt, J=AJP, L=LocalAuth, T=Trust
  error?: string;
}

@Injectable()
export class PanService {
  private readonly logger = new Logger(PanService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Strict format check — does NOT normalize case. Input must be uppercase. */
  validateFormat(pan: string): boolean {
    return PAN_REGEX.test(pan ?? '');
  }

  async verify(pan: string, userId?: string): Promise<PanVerificationResult> {
    const normalized = pan?.toUpperCase().trim();

    if (!this.validateFormat(normalized)) {
      return {
        valid: false,
        error: 'Invalid PAN format. Must be 10 characters: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)',
      };
    }

    const panType = this.getPanType(normalized.charAt(3));
    const result: PanVerificationResult = { valid: true, pan: normalized, panType };

    // In production: call Income Tax API
    // For now, format validation is sufficient; IT API requires production credentials
    this.logger.debug(`PAN format validated: ${normalized} (type: ${panType})`);

    // Fire-and-forget — never block verification on audit log failure
    this.prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        entityType: 'PAN_VERIFICATION',
        entityId: normalized,
        action: 'CREATE',
        newValue: result as any,
      },
    }).catch((err) => this.logger.warn(`PAN audit log failed: ${err.message}`));

    return result;
  }

  /** 4th character of PAN indicates entity type */
  private getPanType(char: string): string {
    const types: Record<string, string> = {
      P: 'Individual',
      C: 'Company',
      H: 'HUF',
      F: 'Firm/LLP',
      A: 'Association of Persons',
      B: 'Body of Individuals',
      G: 'Government',
      J: 'Artificial Juridical Person',
      L: 'Local Authority',
      T: 'Trust',
    };
    return types[char] || 'Unknown';
  }
}
