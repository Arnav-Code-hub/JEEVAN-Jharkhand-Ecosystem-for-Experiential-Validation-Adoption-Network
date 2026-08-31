# ADR-0005: Object storage provider and upload flow

- **Status:** **Accepted** — MinIO in Compose, S3-compatible, presigned direct upload
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 3 - issues completion

## Context

Every intake carries photos, video, and voice notes; G3 requires pilot evidence uploads; the 'Full Circle' deliverable is a video. No project document names an object store, an upload path, size limits, MIME validation, or retention. The entity currently holds imageUrls as a text array, quietly assuming someone else solved uploads.

## Recommendation

S3-compatible storage - MinIO in docker-compose locally, any S3 provider in deployment. Clients upload directly via presigned URLs; the backend stores only metadata in a media table and validates after upload.

## Decision

**S3-compatible object storage behind a `StorageProvider` interface, with MinIO running in Docker
Compose (Option A).** Clients upload directly via presigned PUT URLs; the backend stores only
metadata and validates the object server-side afterwards.

Rationale given at decision time: bytes stay on the EC2 volume in `ap-south-1` (ADR-0014), which is
the cleanest data-localisation story under `parameter.md` section 8 - no cross-border question
arises at all. Because the interface speaks S3, moving to a managed AWS S3 bucket later is an
environment change with no code change.

Consequences now binding:
- MinIO and a bucket-creation init container are part of the Compose stack; the bucket is
  `jeevan-media`.
- Durability of uploaded evidence is now the VM volume's durability. Phase 9 must cover volume
  backups explicitly - this is the main cost of choosing A over a managed bucket.
- Objects are never public. Reads go through a short-lived presigned GET, so a storage key is never
  exposed over the API.
- Validation is two-stage: declared size and MIME are checked before a URL is issued, and the real
  stored object is re-checked on confirm. A client cannot declare a small photo and upload a large
  executable.
- Photos and videos must carry a capture geotag, enforced by a database CHECK constraint as well as
  in the service.

## Consequences if accepted

The backend never handles file bytes, which scales well and keeps request sizes small. Requires post-upload validation since the API cannot inspect content inline. Adds MinIO to the local compose stack.

## Alternatives considered

Proxying uploads through the backend: simpler to validate, but puts large multipart bodies through the API and caps throughput. Rejected for a media-heavy product.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
