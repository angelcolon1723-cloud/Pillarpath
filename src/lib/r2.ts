/**
 * Cloudflare R2 client (S3-compatible).
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 * R2_PUBLIC_URL (optional) enables direct public links; otherwise presigned URLs.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET,
  );
}

function r2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID!;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export function r2Bucket(): string {
  return process.env.R2_BUCKET!;
}

/** Sanitize a filename for use in a storage key. */
export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
}

export function validateUpload(mimeType: string, sizeBytes: number): string | null {
  if (!ALLOWED_MIME.has(mimeType)) {
    return "That file type isn't allowed. PDFs, Office docs, text, CSV, and images only.";
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_BYTES) {
    return "Files must be under 25 MB.";
  }
  return null;
}

/** Presigned URL the browser uses to PUT the file directly to R2. */
export async function r2UploadUrl(key: string, mimeType: string): Promise<string> {
  const client = r2Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: r2Bucket(), Key: key, ContentType: mimeType }),
    { expiresIn: 600 },
  );
}

/** Presigned URL for downloading (1 hour). Falls back to public URL if set. */
export async function r2DownloadUrl(key: string, fileName: string): Promise<string> {
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase) return `${publicBase}/${key}`;
  const client = r2Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeFileName(fileName)}"`,
    }),
    { expiresIn: 3600 },
  );
}

export async function r2Delete(key: string): Promise<void> {
  const client = r2Client();
  await client.send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }));
}

export { MAX_FILE_BYTES };
// R2 env wired 202610051628
