import { ConfigService } from '@nestjs/config';
import {
  BusinessRuleViolationError,
  ForbiddenActionError,
  StateConflictError,
} from '../../shared/errors/domain.error';
import { StorageProvider } from '../../shared/storage/storage.provider';
import { Media, MediaKind, MediaStatus } from './media.entity';
import { MediaService } from './media.service';

const CONFIG = {
  MEDIA_MAX_IMAGE_MB: 10,
  MEDIA_MAX_VIDEO_MB: 100,
  MEDIA_MAX_AUDIO_MB: 20,
  MEDIA_MAX_DOCUMENT_MB: 15,
} as const;

const UPLOADER = 'citizen-1';
const MB = 1024 * 1024;

function makeMedia(overrides: Partial<Media> = {}): Media {
  return {
    id: 'media-1',
    storageKey: 'uploads/citizen-1/abc',
    kind: MediaKind.PHOTO,
    status: MediaStatus.PENDING,
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    uploadedByUserId: UPLOADER,
    issueId: null,
    projectId: null,
    latitude: 23.34,
    longitude: 85.31,
    capturedAt: null,
    checksum: null,
    confirmedAt: null,
    ...overrides,
  } as Media;
}

describe('MediaService', () => {
  let repo: Record<string, jest.Mock>;
  let storage: jest.Mocked<StorageProvider>;
  let service: MediaService;

  beforeEach(() => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'media-1', ...x })),
      find: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };
    storage = {
      createUploadUrl: jest.fn().mockResolvedValue('https://storage/signed-put'),
      createDownloadUrl: jest.fn().mockResolvedValue('https://storage/signed-get'),
      stat: jest.fn(),
      delete: jest.fn(),
    };

    service = new MediaService(repo as never, storage, {
      getOrThrow: <T>(k: keyof typeof CONFIG) => CONFIG[k] as unknown as T,
    } as unknown as ConfigService);
  });

  describe('requestUpload validation', () => {
    const base = {
      kind: MediaKind.PHOTO,
      mimeType: 'image/jpeg',
      sizeBytes: MB,
      latitude: 23.3,
      longitude: 85.3,
    };

    it('issues a presigned URL for a valid request', async () => {
      const ticket = await service.requestUpload(base, UPLOADER);

      expect(ticket.uploadUrl).toBe('https://storage/signed-put');
      expect(ticket.storageKey).toContain(UPLOADER);
    });

    it('rejects a disallowed mime type', async () => {
      await expect(
        service.requestUpload({ ...base, mimeType: 'application/x-msdownload' }, UPLOADER),
      ).rejects.toThrow(BusinessRuleViolationError);
    });

    it('rejects a mime type valid for another kind', async () => {
      await expect(
        service.requestUpload({ ...base, kind: MediaKind.PHOTO, mimeType: 'video/mp4' }, UPLOADER),
      ).rejects.toThrow(BusinessRuleViolationError);
    });

    it('rejects an oversized file before any bytes move', async () => {
      await expect(
        service.requestUpload({ ...base, sizeBytes: 11 * MB }, UPLOADER),
      ).rejects.toThrow(/between 1 byte/);
      expect(storage.createUploadUrl).not.toHaveBeenCalled();
    });

    it.each([
      [MediaKind.PHOTO, 'image/jpeg'],
      [MediaKind.VIDEO, 'video/mp4'],
    ])('requires a geotag on a %s', async (kind, mimeType) => {
      await expect(
        service.requestUpload({ kind, mimeType, sizeBytes: MB }, UPLOADER),
      ).rejects.toThrow(/where it was captured/);
    });

    it('does not require a geotag on audio', async () => {
      await expect(
        service.requestUpload(
          { kind: MediaKind.AUDIO, mimeType: 'audio/ogg', sizeBytes: MB },
          UPLOADER,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('confirmUpload', () => {
    it('rejects when nothing was actually uploaded', async () => {
      repo.findOneBy.mockResolvedValue(makeMedia());
      storage.stat.mockResolvedValue(null);

      await expect(service.confirmUpload('media-1', UPLOADER)).rejects.toThrow(
        /No uploaded object/,
      );
    });

    it('catches a client that declared a small file and uploaded a huge one', async () => {
      repo.findOneBy.mockResolvedValue(makeMedia());
      storage.stat.mockResolvedValue({ sizeBytes: 50 * MB, mimeType: 'image/jpeg', checksum: 'x' });

      await expect(service.confirmUpload('media-1', UPLOADER)).rejects.toThrow(
        BusinessRuleViolationError,
      );
    });

    it('catches a content-type mismatch', async () => {
      repo.findOneBy.mockResolvedValue(makeMedia());
      storage.stat.mockResolvedValue({
        sizeBytes: 1000,
        mimeType: 'application/x-msdownload',
        checksum: 'x',
      });

      await expect(service.confirmUpload('media-1', UPLOADER)).rejects.toThrow(
        /does not match the declared type/,
      );
    });

    it('refuses to confirm another account upload', async () => {
      repo.findOneBy.mockResolvedValue(makeMedia({ uploadedByUserId: 'someone-else' }));

      await expect(service.confirmUpload('media-1', UPLOADER)).rejects.toThrow(
        ForbiddenActionError,
      );
    });

    it('marks it confirmed and records the real size', async () => {
      repo.findOneBy.mockResolvedValue(makeMedia());
      storage.stat.mockResolvedValue({ sizeBytes: 2048, mimeType: 'image/jpeg', checksum: 'abc' });

      const result = await service.confirmUpload('media-1', UPLOADER);

      expect(result.status).toBe(MediaStatus.CONFIRMED);
      expect(result.sizeBytes).toBe(2048);
      expect(result.checksum).toBe('abc');
    });

    it('is idempotent once confirmed', async () => {
      repo.findOneBy.mockResolvedValue(makeMedia({ status: MediaStatus.CONFIRMED }));

      await service.confirmUpload('media-1', UPLOADER);

      expect(storage.stat).not.toHaveBeenCalled();
    });
  });

  describe('attachToIssue', () => {
    it('refuses unconfirmed media as evidence', async () => {
      repo.find.mockResolvedValue([makeMedia({ status: MediaStatus.PENDING })]);

      await expect(service.attachToIssue(['media-1'], 'issue-1', UPLOADER)).rejects.toThrow(
        /must be confirmed/,
      );
    });

    it('refuses media belonging to another account', async () => {
      repo.find.mockResolvedValue([
        makeMedia({ status: MediaStatus.CONFIRMED, uploadedByUserId: 'other' }),
      ]);

      await expect(service.attachToIssue(['media-1'], 'issue-1', UPLOADER)).rejects.toThrow(
        ForbiddenActionError,
      );
    });

    it('refuses media already attached elsewhere', async () => {
      repo.find.mockResolvedValue([
        makeMedia({ status: MediaStatus.CONFIRMED, issueId: 'another-issue' }),
      ]);

      await expect(service.attachToIssue(['media-1'], 'issue-1', UPLOADER)).rejects.toThrow(
        StateConflictError,
      );
    });

    it('attaches valid media', async () => {
      repo.find.mockResolvedValue([makeMedia({ status: MediaStatus.CONFIRMED })]);

      await service.attachToIssue(['media-1'], 'issue-1', UPLOADER);

      expect(repo.update).toHaveBeenCalledWith({ id: expect.anything() }, { issueId: 'issue-1' });
    });

    it('is a no-op for an empty list', async () => {
      await expect(service.attachToIssue([], 'issue-1', UPLOADER)).resolves.toEqual([]);
      expect(repo.find).not.toHaveBeenCalled();
    });
  });
});
