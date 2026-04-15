import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman & Nicobar Islands',
  'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Jammu & Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

export class AddressDto {
  @ApiProperty({ example: '12, Gandhi Nagar' })
  @IsString()
  addressLine1!: string;

  @ApiProperty({ example: 'Near Post Office', required: false })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ example: 'Mumbai' })
  @IsString()
  city!: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @IsIn(INDIAN_STATES, { message: 'Please select a valid Indian state' })
  state!: string;

  @ApiProperty({ example: '400001' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Pincode must be exactly 6 digits' })
  pincode!: string;
}

export class KycStep2Dto {
  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  registeredOfficeAddress!: AddressDto;

  @ApiProperty({ type: AddressDto, required: false })
  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  businessOfficeAddress?: AddressDto;

  @ApiProperty({ example: false, description: 'True if business address same as registered' })
  @IsBoolean()
  sameAsRegistered!: boolean;
}
