import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateIssueDto } from './issues.dto';

/** Cap the batch so one sync cannot hold a connection open indefinitely. */
export const MAX_SYNC_BATCH = 50;

export class SyncIssuesDto {
  @ApiProperty({ type: [CreateIssueDto], maxItems: MAX_SYNC_BATCH })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SYNC_BATCH)
  @ValidateNested({ each: true })
  @Type(() => CreateIssueDto)
  issues!: CreateIssueDto[];
}

export interface SyncItemResult {
  clientId: string | null;
  /** 'created' | 'duplicate' | 'failed' — a partial failure never fails the batch. */
  outcome: 'created' | 'duplicate' | 'failed';
  issueId?: string;
  error?: string;
}
