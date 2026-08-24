import { supabase } from "./supabaseClient";
import type { PaymentMethod, CryptoCurrency, VerificationApplication } from "@/types/database";

async function uploadDoc(file: File, userId: string, prefix: string): Promise<string> {
  const path = `${userId}/${prefix}-${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from("verification-docs").upload(path, file, { contentType: file.type });
  if (error) throw error;
  // Bucket is private — store the path, not a public URL; generate a
  // signed URL on demand when actually displaying it back to the owner.
  return path;
}

export async function getMyLatestApplication(): Promise<VerificationApplication | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("verification_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function submitVerificationApplication({
  fullName,
  statement,
  idFile,
  paymentMethod,
  cryptoCurrency,
  txScreenshotFile,
}: {
  fullName: string;
  statement: string;
  idFile: File;
  paymentMethod: PaymentMethod;
  cryptoCurrency: CryptoCurrency | null;
  txScreenshotFile: File | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const idDocumentPath = await uploadDoc(idFile, user.id, "id");
  const txScreenshotPath = txScreenshotFile ? await uploadDoc(txScreenshotFile, user.id, "txn") : null;

  const { error } = await supabase.from("verification_applications").insert({
    user_id: user.id,
    full_name: fullName,
    statement: statement || null,
    id_document_url: idDocumentPath,
    payment_method: paymentMethod,
    crypto_currency: cryptoCurrency,
    tx_screenshot_url: txScreenshotPath,
  });
  if (error) throw error;
}
