"use client";

import { useState } from "react";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";

export default function ConversationActionSheet({
  username,
  onDelete,
  onBlockAndDelete,
  onReport,
  onClose,
}: {
  username: string;
  onDelete: () => void;
  onBlockAndDelete: () => void;
  onReport: (reason: string) => void;
  onClose: () => void;
}) {
  useScrollLock();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  if (reporting) {
    return (
      <Portal>
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
          <div className="safe-bottom w-full max-w-lg overflow-hidden rounded-t-2xl glass-card p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">Report {username}</p>
            <p className="mt-1 text-xs text-ink-muted">Optional — tell us what's going on.</p>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="What happened?"
              className="mt-3 w-full resize-none rounded-xl2 bg-black/5 px-3.5 py-2.5 text-sm outline-none dark:bg-white/10"
            />
            <button
              onClick={() => onReport(reason.trim())}
              className="mt-3 w-full rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white"
            >
              Submit report
            </button>
            <button onClick={onClose} className="mt-2 w-full py-2 text-sm font-medium text-ink-muted">
              Cancel
            </button>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
        <div className="safe-bottom w-full max-w-lg overflow-hidden rounded-t-2xl glass-card" onClick={(e) => e.stopPropagation()}>
          <button onClick={onDelete} className="w-full border-b border-black/5 px-4 py-3.5 text-center text-[15px] font-medium text-red-500 dark:border-white/5">
            Delete chat
          </button>
          <button onClick={onBlockAndDelete} className="w-full border-b border-black/5 px-4 py-3.5 text-center text-[15px] font-medium text-red-500 dark:border-white/5">
            Block and delete
          </button>
          <button onClick={() => setReporting(true)} className="w-full border-b border-black/5 px-4 py-3.5 text-center text-[15px] font-medium dark:border-white/5">
            Report
          </button>
          <button onClick={onClose} className="w-full px-4 py-3.5 text-center text-[15px] font-semibold text-ink-muted">
            Cancel
          </button>
        </div>
      </div>
    </Portal>
  );
}
