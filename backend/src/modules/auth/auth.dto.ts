import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'E.164 phone number (citizens) or email address (all other roles)',
  })
  @IsString()
  @MaxLength(255)
  identifier!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be six digits' })
  otp!: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'TOTP code. Required for government roles (parameter.md §2).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'totp must be six digits' })
  totp?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @Length(16, 512)
  refreshToken!: string;
}

export class ConfirmTotpDto {
  @ApiProperty({ description: 'Token returned by otp/verify when enrolment is required' })
  @IsString()
  @Length(16, 2048)
  enrolmentToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  code!: string;
}
