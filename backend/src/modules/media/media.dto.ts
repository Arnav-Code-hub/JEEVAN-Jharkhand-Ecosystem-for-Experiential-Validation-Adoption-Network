import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaKind } from './media.entity';

export class RequestUploadDto {
  @ApiProperty({ enum: MediaKind })
  @IsEnum(MediaKind)
  kind!: MediaKind;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 482913, description: 'Declared size; re-checked on confirm' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @ApiPropertyOptional({ description: 'Capture latitude. Required for photo and video.' })
  @IsOptional()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Capture longitude. Required for photo and video.' })
  @IsOptional()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: '2026-08-31T09:15:00Z' })
  @IsOptional()
  @IsISO8601()
  capturedAt?: string;
}
