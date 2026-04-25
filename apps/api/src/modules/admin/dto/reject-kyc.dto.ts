import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectKycDto {
  @ApiProperty({ example: 'GST certificate name does not match PAN cardholder name.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  rejectionReason!: string;
}
