import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEmail,
  MaxLength,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IssueCategory, IntakeChannel } from './issue.entity';

export class CreateIssueDto {
  @ApiProperty({ example: 'Broken water pipe on main road' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Water pipe burst near Ranchi market causing flooding' })
  @IsString()
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: IssueCategory })
  @IsEnum(IssueCategory)
  category!: IssueCategory;

  @ApiPropertyOptional({ enum: IntakeChannel })
  @IsOptional()
  @IsEnum(IntakeChannel)
  channel?: IntakeChannel;

  @ApiProperty({ example: 'Rajesh Kumar' })
  @IsString()
  @MaxLength(100)
  citizenName!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  citizenPhone?: string;

  @ApiPropertyOptional({ example: 'citizen@example.com' })
  @IsOptional()
  @IsEmail()
  citizenEmail?: string;

  // Geolocation
  @ApiPropertyOptional({ example: 23.3441 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 85.3096 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 'Near Ranchi Main Market' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Ranchi' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'Kanke' })
  @IsOptional()
  @IsString()
  block?: string;

  // Attachments: ids of media already uploaded and confirmed via /media.
  @ApiPropertyOptional({ type: [String], description: 'Confirmed media ids to attach' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mediaIds?: string[];

  @ApiPropertyOptional({
    description:
      'Client-generated idempotency key. Resubmitting the same key returns the existing issue.',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}

export class UpdateIssueDto extends PartialType(CreateIssueDto) {}
