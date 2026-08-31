import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum MediaKind {
  PHOTO = 'photo',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

export enum MediaStatus {
  /** Row created, presigned URL issued, bytes not yet confirmed in storage. */
  PENDING = 'pending',
  /** Object verified present, size and type checked. Usable as evidence. */
  CONFIRMED = 'confirmed',
}

/**
 * One uploaded file.
 *
 * Replaces the `imageUrls text[]` column, which could not carry the per-file
 * geotag that `parameter.md` mandates for every photo and video, and could not
 * express the G3 pilot-evidence uploads that Phase 7 needs.
 *
 * `latitude`/`longitude` here are the *capture* location reported by the device,
 * which is what makes a photo evidence rather than decoration.
 */
@Entity('media')
@Unique('UQ_media_storage_key', ['storageKey'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ type: 'enum', enum: MediaKind })
  kind!: MediaKind;

  @Index()
  @Column({ type: 'enum', enum: MediaStatus, default: MediaStatus.PENDING })
  status!: MediaStatus;

  @Column({ type: 'varchar', length: 120 })
  mimeType!: string;

  @Column({ type: 'bigint', default: 0 })
  sizeBytes!: string | number;

  /** Uploader, taken from the access token — never from the request body. */
  @Index()
  @Column({ type: 'uuid' })
  uploadedByUserId!: string;

  /** Set once the media is attached to an issue. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  issueId!: string | null;

  /** Reserved for G3 pilot evidence, attached to a project rather than an issue. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  capturedAt!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;
}
