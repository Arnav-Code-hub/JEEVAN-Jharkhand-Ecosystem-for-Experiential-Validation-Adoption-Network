import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Offset pagination for list endpoints.
 *
 * Offset rather than cursor because every current list is ordered by a
 * non-unique column (`createdAt`) and admin screens need a total count and
 * arbitrary page jumps. Cursor pagination should replace this on any endpoint
 * that later needs to walk a large, frequently-changing set.
 *
 * The cap matters: before Phase 3 these endpoints were unbounded, so a single
 * request would return every issue in the state.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}

export class PaginatedResponse<T> {
  @ApiProperty({ isArray: true })
  items!: T[];

  @ApiProperty({ description: 'Total rows matching the filter, ignoring pagination' })
  total!: number;

  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;

  @ApiProperty({ description: 'True when further rows exist beyond this page' })
  hasMore!: boolean;

  static of<T>(items: T[], total: number, query: PaginationQueryDto): PaginatedResponse<T> {
    return {
      items,
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + items.length < total,
    };
  }
}
