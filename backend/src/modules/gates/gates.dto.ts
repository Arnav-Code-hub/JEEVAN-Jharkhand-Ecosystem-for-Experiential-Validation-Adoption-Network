import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class G1DecisionDto {
  @ApiProperty({ description: 'true passes the gate, false rejects the issue' })
  @IsBoolean()
  pass!: boolean;

  @ApiPropertyOptional({
    description: 'Required when failing. Never include citizen PII (parameter.md §8).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Territorial org unit the project belongs to' })
  @IsOptional()
  @IsUUID()
  orgUnitId?: string;
}
