import { supabase } from "./supabaseClient";
import { compressImage, generateTinyPlaceholder } from "./compressImage";
import { compressVideo, extractThumbnail } from "./compressVideo";
import { computeCropRect, composeCrop, FEED_ASPECTS } from "./cropMath";
import type { MediaEditorResult } from "../components/PostMediaEditor";
import type { MediaType } from "@/types/database";

export type UploadStage = "compressing" | "uploading" | "saving" | "done";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

function loadImageDims(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

function getVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video dimensions"));
    };
    video.src = url;
  });
}

async function processMedia(file: File, edit?: MediaEditorResult) {
  const isVideo = file.type.startsWith("video/");
  const mediaType: MediaType = isVideo ? "video" : "image";

  if (!edit) {
    // Stories: full media, no feed-frame/cover cropping applied.
    if (isVideo) {
      const compressed = await compressVideo(file);
      const thumbnailBlob = await extractThumbnail(file);
      return { mediaFile: compressed.file, thumbnailBlob, width: compressed.width, height: compressed.height, mediaType };
    }
    const compressed = await compressImage(file);
    const thumbnailBlob = await dataUrlToBlob(await generateTinyPlaceholder(file));
    return { mediaFile: compressed.file, thumbnailBlob, width: compressed.width, height: compressed.height, mediaType };
  }

  const targetAspect = FEED_ASPECTS[edit.aspect];

  // The square cover crop, expressed in the frame-crop's own 0-1 space —
  // reused below for both video and image, composed with the frame crop
  // to land back in original-source coordinates.
  const squareGuide = computeCropRect(targetAspect, 1, 1, edit.coverFocalX, edit.coverFocalY);

  async function buildCoverFromCustomFile(customFile: File): Promise<Blob> {
    const dims = await loadImageDims(customFile);
    const coverCrop = computeCropRect(dims.width, dims.height, 1, edit!.coverFocalX, edit!.coverFocalY);
    const { file: coverFile } = await compressImage(customFile, { maxWidth: 640, crop: coverCrop });
    return coverFile;
  }

  if (isVideo) {
    const nativeDims = await getVideoDimensions(file);
    const frameCrop = computeCropRect(nativeDims.width, nativeDims.height, targetAspect, edit.focalX, edit.focalY);
    const compressed = await compressVideo(file, frameCrop);

    let thumbnailBlob: Blob;
    if (edit.customCoverFile) {
      thumbnailBlob = await buildCoverFromCustomFile(edit.customCoverFile);
    } else {
      const rawFrameBlob = await extractThumbnail(file);
      const frameFile = new File([rawFrameBlob], "frame.jpg", { type: "image/jpeg" });
      const composedCoverCrop = composeCrop(frameCrop, squareGuide);
      const { file: coverFile } = await compressImage(frameFile, { maxWidth: 640, crop: composedCoverCrop });
      thumbnailBlob = coverFile;
    }

    return { mediaFile: compressed.file, thumbnailBlob, width: compressed.width, height: compressed.height, mediaType };
  }

  const nativeDims = await loadImageDims(file);
  const frameCrop = computeCropRect(nativeDims.width, nativeDims.height, targetAspect, edit.focalX, edit.focalY);
  const compressed = await compressImage(file, { crop: frameCrop });

  let thumbnailBlob: Blob;
  if (edit.customCoverFile) {
    thumbnailBlob = await buildCoverFromCustomFile(edit.customCoverFile);
  } else {
    const composedCoverCrop = composeCrop(frameCrop, squareGuide);
    const { file: coverFile } = await compressImage(file, { maxWidth: 640, crop: composedCoverCrop });
    thumbnailBlob = coverFile;
  }

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

async function triggerModeration(table: "posts" | "stories", id: string, mediaUrl: string) {
  try {
    await supabase.functions.invoke("moderate-media", { body: { table, id, mediaUrl } });
  } catch {
    // Non-fatal: the post/story was already saved as 'pending'. If the scan
    // call fails (network blip, function cold start, etc.) the content just
    // stays pending — visible only to its owner — until a retry sweep or
    // manual review picks it up, rather than the upload itself failing.
  }
}

export async function uploadPost({
  file,
  caption,
  edit,
  onProgress,
}: {
  file: File;
  caption: string;
  edit?: MediaEditorResult;
  onProgress?: (stage: UploadStage) => void;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to post.");

  onProgress?.("compressing");
  const { mediaFile, thumbnailBlob, width, height, mediaType } = await processMedia(file, edit);

  onProgress?.("uploading");
  const { mediaUrl, thumbnailUrl } = await uploadToBucket("posts", user.id, mediaFile, thumbnailBlob);

  onProgress?.("saving");
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
      thumbnail_url: thumbnailUrl,
      caption: caption || null,
      width,
      height,
      cover_focal_x: edit?.coverFocalX ?? 0.5,
      cover_focal_y: edit?.coverFocalY ?? 0.5,
    })
    .select("id")
    .single();
  if (error) throw error;

  await triggerModeration("posts", post.id, mediaType === "video" ? thumbnailUrl : mediaUrl);

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
  const { data: story, error } = await supabase
    .from("stories")
    .insert({
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
      thumbnail_url: thumbnailUrl,
    })
    .select("id")
    .single();
  if (error) throw error;

  await triggerModeration("stories", story.id, mediaType === "video" ? thumbnailUrl : mediaUrl);

  onProgress?.("done");
}

export async function uploadCarouselPost({
  files,
  caption,
  onProgress,
}: {
  files: File[];
  caption: string;
  onProgress?: (stage: UploadStage) => void;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to post.");
  if (files.length < 2) throw new Error("A carousel needs at least 2 images.");
  if (files.some((f) => !f.type.startsWith("image/"))) {
    throw new Error("Carousels support photos only — no videos.");
  }

  onProgress?.("compressing");
  const compressedItems = await Promise.all(
    files.map(async (file) => {
      const { file: mediaFile, width, height } = await compressImage(file);
      return { mediaFile, width, height };
    })
  );

  // A real center-square crop of the first slide, not the old 32px blurred
  // placeholder — carousels don't have their own aspect/cover editor yet,
  // but the grid tile should still look like an actual photo.
  const firstDims = await loadImageDims(files[0]);
  const coverCrop = computeCropRect(firstDims.width, firstDims.height, 1, 0.5, 0.5);
  const { file: firstThumbFile } = await compressImage(files[0], { maxWidth: 640, crop: coverCrop });
  const firstThumbBlob: Blob = firstThumbFile;

  onProgress?.("uploading");
  const uploadedUrls: { url: string; width: number; height: number }[] = [];
  let thumbnailUrl = "";

  for (let i = 0; i < compressedItems.length; i++) {
    const { mediaFile, width, height } = compressedItems[i];
    const path = `${user.id}/${crypto.randomUUID()}-${mediaFile.name}`;
    const { error } = await supabase.storage.from("posts").upload(path, mediaFile, { contentType: mediaFile.type });
    if (error) throw error;
    const url = supabase.storage.from("posts").getPublicUrl(path).data.publicUrl;
    uploadedUrls.push({ url, width, height });

    if (i === 0) {
      const thumbPath = `${user.id}/${crypto.randomUUID()}-thumb.jpg`;
      const { error: thumbError } = await supabase.storage.from("posts").upload(thumbPath, firstThumbBlob, { contentType: "image/jpeg" });
      if (thumbError) throw thumbError;
      thumbnailUrl = supabase.storage.from("posts").getPublicUrl(thumbPath).data.publicUrl;
    }
  }

  onProgress?.("saving");
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      media_type: "carousel",
      media_url: null,
      thumbnail_url: thumbnailUrl,
      caption: caption || null,
      width: uploadedUrls[0].width,
      height: uploadedUrls[0].height,
    })
    .select("id")
    .single();
  if (postError || !post) throw postError ?? new Error("Failed to create post");

  await triggerModeration("posts", post.id, thumbnailUrl);

  const mediaRows = uploadedUrls.map((item, i) => ({
    post_id: post.id,
    media_url: item.url,
    width: item.width,
    height: item.height,
    position: i,
  }));
  const { error: mediaError } = await supabase.from("post_media").insert(mediaRows);
  if (mediaError) throw mediaError;

  onProgress?.("done");
}
