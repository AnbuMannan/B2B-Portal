import { Module } from '@nestjs/common';
import { LeadContactService } from './lead-contact.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { EncryptionService } from '../../database/encryption.service';

@Module({
  providers: [LeadContactService, EncryptionUtil, EncryptionService],
  exports: [LeadContactService],
})
export class LeadContactModule {}
