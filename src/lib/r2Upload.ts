export async function uploadToR2(
  file: Blob,
  filename: string,
  contentType: string,
  folder: "posts" | "stories"
): Promise<string> {
  const res = await fetch("/api/r2-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType, folder }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to get an upload URL");

  const putRes = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload to storage failed");

  return data.publicUrl;
}
