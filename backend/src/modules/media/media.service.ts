import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  BusinessRuleViolationError,
  ForbiddenActionError,
  ResourceNotFoundError,
  StateConflictError,
} from '../../shared/errors/domain.error';
import { STORAGE_PROVIDER, StorageProvider } from '../../shared/storage/storage.provider';
import { Media, MediaKind, MediaStatus } from './media.entity';
import { RequestUploadDto } from './media.dto';

/** Types accepted per kind. An allowlist, never a denylist. */
const ALLOWED_MIME: Readonly<Record<MediaKind, readonly string[]>> = {
  [MediaKind.PHOTO]: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  [MediaKind.VIDEO]: ['video/mp4', 'video/quicktime', 'video/webm'],
  [MediaKind.AUDIO]: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac'],
  [MediaKind.DOCUMENT]: ['application/pdf'],
};

/** Kinds that must carry a capture location (parameter.md: geotag all photos/video). */
const GEOTAG_REQUIRED: readonly MediaKind[] = [MediaKind.PHOTO, MediaKind.VIDEO];

const UPLOAD_URL_TTL_SECONDS = 900;
const DOWNLOAD_URL_TTL_SECONDS = 300;

export interface UploadTicket {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

@Injectable()
export class MediaService {
  private readonly maxBytes: Readonly<Record<MediaKind, number>>;

  constructor(
    @InjectRepository(Media) private readonly repo: Repository<Media>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    config: ConfigService,
  ) {
    const imageMb = config.getOrThrow<number>('MEDIA_MAX_IMAGE_MB');
    const videoMb = config.getOrThrow<number>('MEDIA_MAX_VIDEO_MB');
    const audioMb = config.getOrThrow<number>('MEDIA_MAX_AUDIO_MB');
    const docMb = config.getOrThrow<number>('MEDIA_MAX_DOCUMENT_MB');

    this.maxBytes = {
      [MediaKind.PHOTO]: imageMb * 1024 * 1024,
      [MediaKind.VIDEO]: videoMb * 1024 * 1024,
      [MediaKind.AUDIO]: audioMb * 1024 * 1024,
      [MediaKind.DOCUMENT]: docMb * 1024 * 1024,
    };
  }

  /**
   * Issues a presigned upload URL (ADR-0005).
   *
   * Validation happens here, before any bytes move: an oversized or wrong-typed
   * upload is refused without consuming bandwidth. The backend never handles the
   * file itself, which is what keeps a media-heavy product from bottlenecking on
   * the API process.
   */
  async requestUpload(dto: RequestUploadDto, uploaderUserId: string): Promise<UploadTicket> {
    this.assertMimeAllowed(dto.kind, dto.mimeType);
    this.assertSizeAllowed(dto.kind, dto.sizeBytes);

    if (
      GEOTAG_REQUIRED.includes(dto.kind) &&
      (dto.latitude === undefined || dto.longitude === undefined)
    ) {
      throw new BusinessRuleViolationError(
        `A ${dto.kind} must carry the location where it was captured.`,
      );
    }

    const storageKey = `uploads/${uploaderUserId}/${randomUUID()}`;

    const media = await this.repo.save(
      this.repo.create({
        storageKey,
        kind: dto.kind,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        uploadedByUserId: uploaderUserId,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : null,
        status: MediaStatus.PENDING,
      }),
    );

    const uploadUrl = await this.storage.createUploadUrl(
      storageKey,
      dto.mimeType,
      UPLOAD_URL_TTL_SECONDS,
    );

    return {
      mediaId: media.id,
      uploadUrl,
      storageKey,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  /**
   * Confirms the bytes actually landed, and that they match what was declared.
   *
   * Because the client uploads directly to storage, this is the only point at
   * which the real object can be checked — a client could otherwise declare a
   * 1 MB photo and upload a 4 GB file.
   */
  async confirmUpload(mediaId: string, uploaderUserId: string): Promise<Media> {
    const media = await this.findOwned(mediaId, uploaderUserId);

    if (media.status === MediaStatus.CONFIRMED) return media;

    const stored = await this.storage.stat(media.storageKey);
    if (!stored) {
      throw new BusinessRuleViolationError('No uploaded object found for this media record.');
    }

    this.assertSizeAllowed(media.kind, stored.sizeBytes);

    if (stored.mimeType && stored.mimeType !== media.mimeType) {
      throw new BusinessRuleViolationError(
        'Uploaded content type does not match the declared type.',
        {
          declared: media.mimeType,
          actual: stored.mimeType,
        },
      );
    }

    media.status = MediaStatus.CONFIRMED;
    media.sizeBytes = stored.sizeBytes;
    media.checksum = stored.checksum;
    media.confirmedAt = new Date();

    return this.repo.save(media);
  }

  /**
   * Attaches confirmed, unattached media owned by the caller to an issue.
   *
   * Runs as one update so a partial attach cannot leave an issue holding half
   * its evidence.
   */
  async attachToIssue(
    mediaIds: string[],
    issueId: string,
    uploaderUserId: string,
  ): Promise<Media[]> {
    if (mediaIds.length === 0) return [];

    const media = await this.repo.find({ where: { id: In(mediaIds) } });

    if (media.length !== mediaIds.length) {
      throw new ResourceNotFoundError('One or more media items do not exist');
    }

    for (const item of media) {
      if (item.uploadedByUserId !== uploaderUserId) {
        throw new ForbiddenActionError('Cannot attach media uploaded by someone else');
      }
      if (item.status !== MediaStatus.CONFIRMED) {
        throw new BusinessRuleViolationError('Media must be confirmed before it can be attached', {
          mediaId: item.id,
        });
      }
      if (item.issueId && item.issueId !== issueId) {
        throw new StateConflictError('Media is already attached to another issue', {
          mediaId: item.id,
        });
      }
    }

    await this.repo.update({ id: In(mediaIds) }, { issueId });
    return this.repo.find({ where: { id: In(mediaIds) } });
  }

  findForIssue(issueId: string): Promise<Media[]> {
    return this.repo.find({
      where: { issueId, status: MediaStatus.CONFIRMED },
      order: { createdAt: 'ASC' },
    });
  }

  async findForIssues(issueIds: string[]): Promise<Map<string, Media[]>> {
    const grouped = new Map<string, Media[]>();
    if (issueIds.length === 0) return grouped;

    const rows = await this.repo.find({
      where: { issueId: In(issueIds), status: MediaStatus.CONFIRMED },
      order: { createdAt: 'ASC' },
    });

    for (const row of rows) {
      if (!row.issueId) continue;
      const list = grouped.get(row.issueId) ?? [];
      list.push(row);
      grouped.set(row.issueId, list);
    }

    return grouped;
  }

  /** Objects are never public; reads go through a short-lived signed URL. */
  async createDownloadUrl(mediaId: string): Promise<{ url: string; expiresInSeconds: number }> {
    const media = await this.repo.findOneBy({ id: mediaId });
    if (!media) throw new ResourceNotFoundError(`Media ${mediaId} not found`);

    return {
      url: await this.storage.createDownloadUrl(media.storageKey, DOWNLOAD_URL_TTL_SECONDS),
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    };
  }

  countConfirmedForIssue(issueId: string): Promise<number> {
    return this.repo.count({ where: { issueId, status: MediaStatus.CONFIRMED } });
  }

  private async findOwned(mediaId: string, uploaderUserId: string): Promise<Media> {
    const media = await this.repo.findOneBy({ id: mediaId });
    if (!media) throw new ResourceNotFoundError(`Media ${mediaId} not found`);
    if (media.uploadedByUserId !== uploaderUserId) {
      throw new ForbiddenActionError('This upload belongs to another account');
    }
    return media;
  }

  private assertMimeAllowed(kind: MediaKind, mimeType: string): void {
    if (!ALLOWED_MIME[kind].includes(mimeType)) {
      throw new BusinessRuleViolationError(`${mimeType} is not an accepted ${kind} type`, {
        allowed: ALLOWED_MIME[kind],
      });
    }
  }

  private assertSizeAllowed(kind: MediaKind, sizeBytes: number): void {
    const max = this.maxBytes[kind];
    if (sizeBytes <= 0 || sizeBytes > max) {
      throw new BusinessRuleViolationError(`A ${kind} must be between 1 byte and ${max} bytes`, {
        sizeBytes,
        maxBytes: max,
      });
    }
  }
}
