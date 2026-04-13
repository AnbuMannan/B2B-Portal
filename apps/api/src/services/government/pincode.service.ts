import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RedisService } from '../redis/redis.service';

export interface PincodeResult {
  valid: boolean;
  pincode?: string;
  city?: string;
  state?: string;
  district?: string;
  postOfficeName?: string;
  error?: string;
}

const CACHE_TTL_SECONDS = 86400; // 24 hours — pincode data is stable

@Injectable()
export class PincodeService {
  private readonly logger = new Logger(PincodeService.name);

  constructor(private readonly redis: RedisService) {}

  async lookup(pincode: string): Promise<PincodeResult> {
    if (!/^\d{6}$/.test(pincode)) {
      return { valid: false, error: 'Pincode must be exactly 6 digits' };
    }

    const cacheKey = `pincode:${pincode}`;
    const cached = await this.redis.get<PincodeResult>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, {
        timeout: 5000,
      });

      const data = response.data?.[0];
      if (!data || data.Status !== 'Success' || !data.PostOffice?.length) {
        const result: PincodeResult = { valid: false, pincode, error: 'Pincode not found' };
        await this.redis.set(cacheKey, result, CACHE_TTL_SECONDS);
        return result;
      }

      const po = data.PostOffice[0];
      const result: PincodeResult = {
        valid: true,
        pincode,
        city: po.Division || po.Name,
        state: po.State,
        district: po.District,
        postOfficeName: po.Name,
      };

      await this.redis.set(cacheKey, result, CACHE_TTL_SECONDS);
      return result;
    } catch (err: any) {
      this.logger.warn(`Pincode API error for ${pincode}: ${err.message}`);
      return { valid: false, pincode, error: 'Pincode lookup service unavailable' };
    }
  }
}
