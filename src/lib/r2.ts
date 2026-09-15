import { S3Client } from "@aws-sdk/client-s3";

// Server-only — never import from a client component. R2's S3-compatible
// API needs the account's access key/secret to sign requests; those can
// never be exposed to the browser, which is why uploads go through a
// presigned-URL route instead of a direct client-side PUT with these
// credentials baked in.
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;
// Public base URL for reading objects back — either the bucket's r2.dev
// dev URL or a custom domain you've attached to the bucket. No trailing
// slash.
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;
