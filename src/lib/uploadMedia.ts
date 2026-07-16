import { supabase } from "./supabaseClient";
import { compressImage, generateTinyPlaceholder } from "./compressImage";
import { compressVideo, extractThumbnail } from "./compressVideo";
import type { MediaType } from "@/types/database";

export type UploadStage = "compressing" | "uploading" | "saving" | "done";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

async function processMedia(file: File) {
  const isVideo = file.type.startsWith("video/");
  const mediaType: MediaType = isVideo ? "video" : "image";

  if (isVideo) {
    const compressed = await compressVideo(file);
    const thumbnailBlob = await extractThumbnail(file);
    return { mediaFile: compressed.file, thumbnailBlob, width: compressed.width, height: compressed.height, mediaType };
  }

  const compressed = await compressImage(file);
  const thumbnailBlob = await dataUrlToBlob(await generateTinyPlaceholder(file));
  return { mediaFile: compressed.file, thumbnailBlob, width: compressed.width, height: compressed.height, mediaType };
}

async function uploadToBucket(bucket: string, userId: string, mediaFile: File, thumbnailBlob: Blob) {
  const mediaPath = `${userId}/${crypto.randomUUID()}-${mediaFile.name}`;
  const thumbPath = `${userId}/${crypto.randomUUID()}-thumb.jpg`;

  const { error: mediaError } = await supabase.storage.from(bucket).upload(mediaPath, mediaFile, {
    contentType: mediaFile.type,
  });
  if (mediaError) throw mediaError;

  const { error: thumbError } = await supabase.storage.from(bucket).upload(thumbPath, thumbnailBlob, {
    contentType: "image/jpeg",
  });
  if (thumbError) throw thumbError;

  const mediaUrl = supabase.storage.from(bucket).getPublicUrl(mediaPath).data.publicUrl;
  const thumbnailUrl = supabase.storage.from(bucket).getPublicUrl(thumbPath).data.publicUrl;

  return { mediaUrl, thumbnailUrl };
}

export async function uploadPost({
  file,
  caption,
  onProgress,
}: {
  file: File;
  caption: string;
  onProgress?: (stage: UploadStage) => void;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to post.");

  onProgress?.("compressing");
  const { mediaFile, thumbnailBlob, width, height, mediaType } = await processMedia(file);

  onProgress?.("uploading");
  const { mediaUrl, thumbnailUrl } = await uploadToBucket("posts", user.id, mediaFile, thumbnailBlob);

  onProgress?.("saving");
  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    media_url: mediaUrl,
    media_type: mediaType,
    thumbnail_url: thumbnailUrl,
    caption: caption || null,
    width,
    height,
  });
  if (error) throw error;

  onProgress?.("done");
}

export async function uploadStory({
  file,
  onProgress,
}: {
  file: File;
  onProgress?: (stage: UploadStage) => void;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to post a story.");

  onProgress?.("compressing");
  const { mediaFile, thumbnailBlob, mediaType } = await processMedia(file);

  onProgress?.("uploading");
  const { mediaUrl, thumbnailUrl } = await uploadToBucket("stories", user.id, mediaFile, thumbnailBlob);

  onProgress?.("saving");
  // expires_at defaults to now() + 24h at the database level — nothing to set here
  const { error } = await supabase.from("stories").insert({
    user_id: user.id,
    media_url: mediaUrl,
    media_type: mediaType,
    thumbnail_url: thumbnailUrl,
  });
  if (error) throw error;

  onProgress?.("done");
}
