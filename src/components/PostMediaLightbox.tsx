"use client";

import type { Post } from "@/types/database";
import Portal from "./Portal";
import { useScrollLock } from "@/lib/useScrollLock";

// Opened by a long-press on a post's media. Deliberately bare — no header,
// no username, no like/comment/save rail, just the media itself on a
// blurred backdrop. Tapping the backdrop or the close button dismisses it;
// tapping the media itself does not (so carousel swiping and video controls
// still work without accidentally closing the viewer).
export default function PostMediaLightbox({ post, onClose }: { post: Post; onClose: () => void }) {
  useScrollLock();
  const carouselItems = post.media_type === "carousel" ? post.post_media ?? [] : null;

  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-2xl"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-5 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {carouselItems ? (
        <div className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto">
          {carouselItems.map((item) => (
            <div key={item.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-2">
              <img
                src={item.media_url}
                alt=""
                className="max-h-full max-w-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ))}
        </div>
      ) : post.media_type === "text" ? (
        <div className="mx-8 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <p className="text-2xl font-medium leading-relaxed text-white">{post.text_content}</p>
        </div>
      ) : post.media_type === "video" ? (
        <video
          src={post.media_url ?? undefined}
          controls
          autoPlay
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={post.media_url ?? undefined}
          alt=""
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
    </Portal>
  );
}
