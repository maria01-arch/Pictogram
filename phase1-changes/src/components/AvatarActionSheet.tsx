"use client";

import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";

export default function AvatarActionSheet({
  hasStory,
  onViewPhoto,
  onViewStatus,
  onClose,
}: {
  hasStory: boolean;
  onViewPhoto: () => void;
  onViewStatus: () => void;
  onClose: () => void;
}) {
  useScrollLock();

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
        <div
          className="safe-bottom w-full max-w-lg overflow-hidden rounded-t-2xl glass-card"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onViewPhoto}
            className="w-full border-b border-black/5 px-4 py-3.5 text-center text-[15px] font-medium dark:border-white/5"
          >
            View profile picture
          </button>
          {hasStory && (
            <button
              onClick={onViewStatus}
              className="w-full border-b border-black/5 px-4 py-3.5 text-center text-[15px] font-medium dark:border-white/5"
            >
              View status
            </button>
          )}
          <button onClick={onClose} className="w-full px-4 py-3.5 text-center text-[15px] font-semibold text-ink-muted">
            Cancel
          </button>
        </div>
      </div>
    </Portal>
  );
}
