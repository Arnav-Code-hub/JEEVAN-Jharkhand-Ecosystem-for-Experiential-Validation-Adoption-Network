import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../shared/rbac/rbac.decorators';
import { Role } from '../../shared/rbac/role.enum';
import { Media } from '../media/media.entity';
import { Issue, IntakeChannel, IssueCategory, IssueStatus } from './issue.entity';

/**
 * Roles permitted to see citizen contact details and exact coordinates.
 *
 * parameter.md §8: "Never expose a citizen's Personal Identifiable Information
 * (Phone number, exact home address) to the university or industry dashboards.
 * Only expose the aggregated problem and the general Block/District location."
 *
 * Government reviewers are excluded from masking because contacting the reporter
 * is intrinsic to G1 verification and to the G3 pilot sign-off. A citizen always
 * sees their own submission in full.
 */
const PII_PERMITTED_ROLES: readonly Role[] = [Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN];

/**
 * Decimal places retained when coarsening coordinates for masked viewers.
 * Two places is roughly 1.1 km — enough to cluster a problem to a locality,
 * not enough to identify a household.
 */
const MASKED_COORDINATE_PRECISION = 2;

/**
 * Media as exposed over HTTP. Deliberately no storage key and no URL: a reader
 * calls /media/:id/download-url to get a short-lived signed link, so objects are
 * never publicly addressable.
 *
 * The capture location is itself PII-adjacent — a geotagged photo of a house is
 * a home address — so it is coarsened for masked viewers alongside the issue
 * coordinates.
 */
export class MediaView {
  @ApiProperty() id!: string;
  @ApiProperty() kind!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiPropertyOptional() latitude!: number | null;
  @ApiPropertyOptional() longitude!: number | null;
  @ApiPropertyOptional() capturedAt!: Date | null;
}

export class IssueView {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: IssueCategory }) category!: IssueCategory;
  @ApiProperty({ enum: IssueStatus }) status!: IssueStatus;
  @ApiProperty({ enum: IntakeChannel }) channel!: IntakeChannel;

  @ApiPropertyOptional({ description: 'District. Always visible.' })
  district!: string | null;

  @ApiPropertyOptional({ description: 'Block. Always visible.' })
  block!: string | null;

  @ApiPropertyOptional({ description: 'Omitted for non-government viewers (§8).' })
  address?: string | null;

  @ApiPropertyOptional({ description: 'Coarsened to ~1km for non-government viewers (§8).' })
  latitude!: number | null;

  @ApiPropertyOptional() longitude!: number | null;

  @ApiPropertyOptional({ description: 'Omitted for non-government viewers (§8).' })
  citizenName?: string | null;

  @ApiPropertyOptional({ description: 'Omitted for non-government viewers (§8).' })
  citizenPhone?: string | null;

  @ApiPropertyOptional({ description: 'Omitted for non-government viewers (§8).' })
  citizenEmail?: string | null;

  @ApiProperty({ description: 'Attached evidence. Bytes are fetched via a signed URL.' })
  media!: MediaView[];
  @ApiProperty() isEmergency!: boolean;
  @ApiPropertyOptional() urgencyScore!: number | null;
  @ApiPropertyOptional() aiSummary!: string | null;
  @ApiPropertyOptional() reviewedAt!: Date | null;
  @ApiPropertyOptional() rejectionReason!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  /** True when the viewer received the unmasked record. Aids debugging and tests. */
  @ApiProperty() piiVisible!: boolean;
}

/**
 * TypeORM returns `decimal` columns as strings; normalise before rounding so a
 * coordinate is never emitted as a full-precision string that bypassed masking.
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function coarsen(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  const factor = 10 ** MASKED_COORDINATE_PRECISION;
  return Math.round(n * factor) / factor;
}

/**
 * The single place that decides what a viewer may see of an issue.
 *
 * Every read path must go through this — returning a raw `Issue` entity from a
 * controller is what caused the pre-Phase-3 leak of phone, email, street address
 * and 7-decimal GPS to any caller.
 */
export function toIssueView(
  issue: Issue,
  viewer: AuthenticatedUser,
  media: Media[] = [],
): IssueView {
  const isOwner = issue.reportedByUserId !== null && issue.reportedByUserId === viewer.userId;
  const showPii = PII_PERMITTED_ROLES.includes(viewer.role) || isOwner;

  const view: IssueView = {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    status: issue.status,
    channel: issue.channel,
    district: issue.district,
    block: issue.block,
    latitude: showPii ? toNumber(issue.latitude) : coarsen(issue.latitude),
    longitude: showPii ? toNumber(issue.longitude) : coarsen(issue.longitude),
    media: media.map((m) => ({
      id: m.id,
      kind: m.kind,
      mimeType: m.mimeType,
      sizeBytes: Number(m.sizeBytes),
      latitude: showPii ? toNumber(m.latitude) : coarsen(m.latitude),
      longitude: showPii ? toNumber(m.longitude) : coarsen(m.longitude),
      capturedAt: m.capturedAt,
    })),
    isEmergency: issue.isEmergency,
    urgencyScore: toNumber(issue.urgencyScore),
    aiSummary: issue.aiSummary,
    reviewedAt: issue.reviewedAt,
    rejectionReason: issue.rejectionReason,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    piiVisible: showPii,
  };

  // Contact details and the street address are added only when permitted, so
  // the masked shape omits the keys entirely rather than nulling them — a null
  // still tells a reader the field exists.
  if (showPii) {
    view.citizenName = issue.citizenName;
    view.citizenPhone = issue.citizenPhone;
    view.citizenEmail = issue.citizenEmail;
    view.address = issue.address;
  }

  return view;
}

export function toIssueViews(
  issues: Issue[],
  viewer: AuthenticatedUser,
  mediaByIssue: Map<string, Media[]> = new Map(),
): IssueView[] {
  return issues.map((issue) => toIssueView(issue, viewer, mediaByIssue.get(issue.id) ?? []));
}
