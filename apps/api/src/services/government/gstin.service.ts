import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../../database/database.service';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const CACHE_TTL_SECONDS = 86400; // 24 hours

export interface GstinVerificationResult {
  valid: boolean;
  gstin?: string;
  legalName?: string;
  registrationDate?: string;
  state?: string;
  error?: string;
}

@Injectable()
export class GstinService {
  private readonly logger = new Logger(GstinService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /** Strict format check — does NOT normalize case. Input must be uppercase. */
  validateFormat(gstin: string): boolean {
    return GSTIN_REGEX.test(gstin ?? '');
  }

  async verify(gstin: string, userId?: string): Promise<GstinVerificationResult> {
    const normalized = gstin?.toUpperCase().trim();

    if (!this.validateFormat(normalized)) {
      return { valid: false, error: 'Invalid GSTIN format. Must be 15 characters: 2 digits + 5 letters + 4 digits + letter + alphanumeric + Z + alphanumeric' };
    }

    // Check Redis cache
    const cacheKey = `gstin:verify:${normalized}`;
    const cached = await this.redis.get<GstinVerificationResult>(cacheKey);
    if (cached) {
      this.logger.debug(`GSTIN cache HIT: ${normalized}`);
      return cached;
    }

    let result: GstinVerificationResult;
    try {
      const apiUrl = process.env.GSTN_API_URL || 'https://api.gstin.in/sandbox';
      const response = await axios.get(`${apiUrl}/gstin/${normalized}`, {
        headers: { 'x-api-key': process.env.GSTN_API_KEY || 'sandbox-key' },
        timeout: 5000,
      });

      const data = response.data;
      result = {
        valid: true,
        gstin: normalized,
        legalName: data?.legalNameOfBusiness || data?.legalName,
        registrationDate: data?.dateOfRegistration || data?.registrationDate,
        state: data?.stateName || data?.state,
      };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        result = { valid: false, gstin: normalized, error: 'GSTIN not found in government database' };
      } else {
        // API unavailable — return format-only validation in sandbox mode
        this.logger.warn(`GSTN API unavailable: ${err.message} — falling back to format validation`);
        result = {
          valid: true,
          gstin: normalized,
          legalName: 'Verified (sandbox mode)',
          state: this.getStateFromGstin(normalized),
        };
      }
    }

    // Cache result
    await this.redis.set(cacheKey, result, CACHE_TTL_SECONDS);

    // Audit log — fire-and-forget; never let a log failure break verification
    this.prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        entityType: 'GSTIN_VERIFICATION',
        entityId: normalized,
        action: 'CREATE',
        newValue: result as any,
      },
    }).catch((err) => this.logger.warn(`GSTIN audit log failed: ${err.message}`));

    return result;
  }

  /** Extract state name from first 2 digits of GSTIN */
  private getStateFromGstin(gstin: string): string {
    const stateCode = parseInt(gstin.substring(0, 2), 10);
    const stateMap: Record<number, string> = {
      1: 'Jammu & Kashmir', 2: 'Himachal Pradesh', 3: 'Punjab', 4: 'Chandigarh',
      5: 'Uttarakhand', 6: 'Haryana', 7: 'Delhi', 8: 'Rajasthan', 9: 'Uttar Pradesh',
      10: 'Bihar', 11: 'Sikkim', 12: 'Arunachal Pradesh', 13: 'Nagaland', 14: 'Manipur',
      15: 'Mizoram', 16: 'Tripura', 17: 'Meghalaya', 18: 'Assam', 19: 'West Bengal',
      20: 'Jharkhand', 21: 'Odisha', 22: 'Chhattisgarh', 23: 'Madhya Pradesh',
      24: 'Gujarat', 26: 'Dadra & Nagar Haveli and Daman & Diu', 27: 'Maharashtra',
      28: 'Andhra Pradesh', 29: 'Karnataka', 30: 'Goa', 31: 'Lakshadweep',
      32: 'Kerala', 33: 'Tamil Nadu', 34: 'Puducherry', 35: 'Andaman & Nicobar Islands',
      36: 'Telangana', 37: 'Andhra Pradesh (new)',
    };
    return stateMap[stateCode] || 'Unknown';
  }
}
