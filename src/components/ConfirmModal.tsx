"use client";

import Portal from "./Portal";

// Native window.confirm() shows the browser/OS chrome with the site's URL
// ("yoursite.com says…"), which looks broken/untrustworthy in an app. This
// is a plain in-app replacement — render it conditionally from local state:
//
//   const [confirming, setConfirming] = useState(false);
//   ...
//   <button onClick={() => setConfirming(true)}>Delete</button>
//   {confirming && (
//     <ConfirmModal
//       title="Delete this post?"
//       message="This can't be undone."
//       confirmLabel="Delete"
//       danger
//       onConfirm={() => { setConfirming(false); handleDelete(); }}
//       onCancel={() => setConfirming(false)}
//     />
//   )}
export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl glass-card p-5 pb-6 shadow-lg sm:rounded-2xl"
      >
        <h3 className="text-base font-bold">{title}</h3>
        {message && <p className="mt-1.5 text-sm text-ink-muted">{message}</p>}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full bg-black/5 py-2.5 text-sm font-semibold dark:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold text-white ${
              danger ? "bg-red-500" : "bg-brand-gradient"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
