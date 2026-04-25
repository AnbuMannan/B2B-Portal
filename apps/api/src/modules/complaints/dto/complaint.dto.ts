import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum ComplaintCategoryDto {
  FRAUD = 'FRAUD',
  PRODUCT_QUALITY = 'PRODUCT_QUALITY',
  PAYMENT = 'PAYMENT',
  DELIVERY = 'DELIVERY',
  OTHER = 'OTHER',
}

export class CreateComplaintDto {
  @IsString()
  reportedUserId!: string;

  @IsEnum(ComplaintCategoryDto)
  category!: ComplaintCategoryDto;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class AdminRespondDto {
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsString()
  status?: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}

export class CreateGrievanceContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsString()
  category?: string;
}
