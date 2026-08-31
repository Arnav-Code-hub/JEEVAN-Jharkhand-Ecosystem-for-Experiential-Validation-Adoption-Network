import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHeiDomainDto {
  @ApiProperty({ example: 'bitmesra.ac.in' })
  @IsString()
  @MaxLength(255)
  @Matches(/^@?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'domain must be a bare domain name, e.g. bitmesra.ac.in',
  })
  domain!: string;

  @ApiProperty({ example: 'Birla Institute of Technology, Mesra' })
  @IsString()
  @MaxLength(200)
  institutionName!: string;

  @ApiPropertyOptional({ description: 'HEI-tier org unit students are attached to' })
  @IsOptional()
  @IsUUID()
  orgUnitId?: string;
}

export class SetActiveDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}
