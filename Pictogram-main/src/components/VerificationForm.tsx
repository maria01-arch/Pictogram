"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyLatestApplication, submitVerificationApplication } from "@/lib/verification";
import { CRYPTO_ADDRESSES, isCryptoConfigured } from "@/lib/cryptoAddresses";
import { getErrorMessage } from "@/lib/errorMessage";
import type { CryptoCurrency, PaymentMethod, VerificationApplication } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  pending: "Your application is under review.",
  approved: "Your application was approved! Your badge should appear shortly.",
  rejected: "Your application wasn't approved.",
};

export default function VerificationForm() {
  const router = useRouter();
  const idInputRef = useRef<HTMLInputElement>(null);
  const txInputRef = useRef<HTMLInputElement>(null);

  const [existing, setExisting] = useState<VerificationApplication | null | "loading">("loading");

  const [fullName, setFullName] = useState("");
  const [statement, setStatement] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cryptoPickerOpen, setCryptoPickerOpen] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoCurrency | null>(null);
  const [copied, setCopied] = useState(false);

  const [txFile, setTxFile] = useState<File | null>(null);
  const [txPreview, setTxPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyLatestApplication().then((app) => setExisting(app));
  }, []);

  function handleIdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (idPreview) URL.revokeObjectURL(idPreview);
    setIdFile(file);
    setIdPreview(URL.createObjectURL(file));
  }

  function handleTxFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (txPreview) URL.revokeObjectURL(txPreview);
    setTxFile(file);
    setTxPreview(URL.createObjectURL(file));
  }

  function pickCrypto(currency: CryptoCurrency) {
    setSelectedCrypto(currency);
    setCryptoPickerOpen(false);
    setCopied(false);
  }

  async function copyAddress() {
    if (!selectedCrypto) return;
    await navigator.clipboard.writeText(CRYPTO_ADDRESSES[selectedCrypto].address);
    setCopied(true);
  }

  const canSubmit =
    fullName.trim().length > 0 &&
    statement.trim().length > 0 &&
    !!idFile &&
    paymentMethod === "crypto" &&
    !!selectedCrypto &&
    !!txFile;

  async function handleSubmit() {
    if (!canSubmit || !idFile) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitVerificationApplication({
        fullName: fullName.trim(),
        statement: statement.trim(),
        idFile,
        paymentMethod: paymentMethod!,
        cryptoCurrency: selectedCrypto,
        txScreenshotFile: txFile,
      });
      router.push("/business");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (existing === "loading") {
    return <p className="px-4 py-16 text-center text-sm text-ink-muted">Loading…</p>;
  }

  if (existing && existing.status !== "rejected") {
    return (
      <div className="px-4 py-16 text-center">
        <h2 className="text-lg font-bold">Get verified</h2>
        <p className="mt-3 text-sm text-ink-muted">{STATUS_LABEL[existing.status]}</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="text-lg font-bold">Get verified</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Fill out the application below. We'll review it after payment is confirmed.
      </p>

      {existing?.status === "rejected" && (
        <p className="mt-3 rounded-xl2 bg-red-500/10 p-3 text-sm text-red-500">
          Your previous application wasn't approved{existing.reviewer_notes ? `: ${existing.reviewer_notes}` : "."} You can apply again below.
        </p>
      )}

      {/* Step 1: Application details */}
      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Full legal name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Why should you be verified?</span>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={4}
            className="w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
          />
        </label>
      </div>

      {/* Step 2: ID upload */}
      <div className="mt-5">
        <span className="mb-1 block text-xs font-semibold text-ink-muted">Government-issued ID</span>
        <input ref={idInputRef} type="file" accept="image/*" onChange={handleIdFile} className="hidden" />
        <button
          onClick={() => idInputRef.current?.click()}
          className="flex w-full items-center justify-center overflow-hidden rounded-xl2 border-2 border-dashed border-black/15 bg-black/5 py-6 dark:border-white/15 dark:bg-white/5"
        >
          {idPreview ? (
            <img src={idPreview} alt="ID preview" className="max-h-40 rounded-lg object-contain" />
          ) : (
            <span className="text-sm text-ink-muted">Tap to upload a photo of your ID</span>
          )}
        </button>
      </div>

      {/* Step 3: Payment method */}
      <div className="mt-5">
        <span className="mb-1 block text-xs font-semibold text-ink-muted">Payment method</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled
            className="rounded-xl2 border border-black/10 bg-black/5 py-3 text-sm font-semibold text-ink-muted opacity-50 dark:border-white/10 dark:bg-white/5"
          >
            💳 Card (coming soon)
          </button>
          <button
            onClick={() => setPaymentMethod("crypto")}
            className={`rounded-xl2 border py-3 text-sm font-semibold ${
              paymentMethod === "crypto"
                ? "border-brand-from bg-brand-gradient text-white"
                : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
            }`}
          >
            ₿ Cryptocurrency
          </button>
        </div>
      </div>

      {/* Step 4: Crypto picker + address */}
      {paymentMethod === "crypto" && (
        <div className="mt-4">
          <button
            onClick={() => setCryptoPickerOpen((o) => !o)}
            className="w-full rounded-xl2 bg-black/5 p-3 text-left text-sm font-semibold dark:bg-white/10"
          >
            {selectedCrypto ? `Paying with ${CRYPTO_ADDRESSES[selectedCrypto].label}` : "Choose crypto"}
          </button>

          {cryptoPickerOpen && (
            <div className="mt-2 overflow-hidden rounded-xl2 glass-card">
              {(Object.keys(CRYPTO_ADDRESSES) as CryptoCurrency[])
                .filter(isCryptoConfigured)
                .map((key, i) => (
                  <button
                    key={key}
                    onClick={() => pickCrypto(key)}
                    className={`w-full px-4 py-3 text-left text-sm ${i !== 0 ? "border-t border-black/5 dark:border-white/5" : ""}`}
                  >
                    {CRYPTO_ADDRESSES[key].label} <span className="text-xs text-ink-muted">({CRYPTO_ADDRESSES[key].network})</span>
                  </button>
                ))}
            </div>
          )}

          {selectedCrypto && (
            <div className="mt-3 rounded-xl2 glass-card p-3">
              <p className="text-xs text-ink-muted">Send payment to this {CRYPTO_ADDRESSES[selectedCrypto].label} address:</p>
              <p className="mt-1 break-all font-mono text-sm">{CRYPTO_ADDRESSES[selectedCrypto].address}</p>
              <button onClick={copyAddress} className="mt-2 rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold dark:bg-white/10">
                {copied ? "Copied!" : "Copy address"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Transaction proof */}
      {paymentMethod === "crypto" && selectedCrypto && (
        <div className="mt-5">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Confirm payment — upload a screenshot of the transaction</span>
          <input ref={txInputRef} type="file" accept="image/*" onChange={handleTxFile} className="hidden" />
          <button
            onClick={() => txInputRef.current?.click()}
            className="flex w-full items-center justify-center overflow-hidden rounded-xl2 border-2 border-dashed border-black/15 bg-black/5 py-6 dark:border-white/15 dark:bg-white/5"
          >
            {txPreview ? (
              <img src={txPreview} alt="Transaction screenshot" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <span className="text-sm text-ink-muted">Tap to upload transaction screenshot</span>
            )}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="mt-6 w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Submit application"}
      </button>
    </div>
  );
}
