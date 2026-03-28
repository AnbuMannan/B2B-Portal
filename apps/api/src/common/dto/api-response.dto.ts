import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ApiResponseDto<T> {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: null, required: false })
  @IsObject()
  @IsOptional()
  data?: T;

  @ApiProperty({ example: null, required: false })
  @IsObject()
  @IsOptional()
  error?: any;

  @ApiProperty({ example: 200 })
  @IsOptional()
  statusCode?: number;

  constructor(
    success: boolean,
    message: string,
    data?: T,
    error?: any,
    statusCode?: number
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
    this.statusCode = statusCode;
  }

  static success<T>(message: string, data?: T, statusCode?: number): ApiResponseDto<T> {
    return new ApiResponseDto(true, message, data, undefined, statusCode);
  }

  static error<T = null>(message: string, error?: any, statusCode?: number): ApiResponseDto<T> {
    return new ApiResponseDto<T>(false, message, null as any, error, statusCode);
  }
}