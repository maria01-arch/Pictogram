"use client";

import { useRef, useState } from "react";

interface TapToPlayVideoProps {
  videoUrl: string;
  thumbnailUrl: string | null;
  aspectRatio?: number; // width / height, defaults to 4/5
}

/**
 * The whole point: <video> gets NO src until the user taps.
 * Before that, only a tiny thumbnail (already loaded with the post) is shown.
 * Nothing streams from Supabase Storage until there's real user intent.
 */
export default function TapToPlayVideo({
  videoUrl,
  thumbnailUrl,
  aspectRatio = 4 / 5,
}: TapToPlayVideoProps) {
  const [activated, setActivated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function handleTap() {
    if (!activated) {
      setActivated(true); // this is the moment src gets attached & streaming begins
      setPlaying(true);
      // video.play() fires from onCanPlay once src is mounted
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <div
      className="relative w-full overflow-hidden bg-black"
      style={{ aspectRatio }}
      onClick={handleTap}
      role="button"
      tabIndex={0}
      aria-label={activated ? (playing ? "Pause video" : "Play video") : "Tap to play video"}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleTap()}
    >
      {/* Blurred thumbnail placeholder — the only thing loaded until tapped */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            playing ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {activated && (
        <video
          ref={videoRef}
          src={videoUrl}
          preload="none"
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          onCanPlay={(e) => e.currentTarget.play()}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onEnded={() => setPlaying(false)}
        />
      )}

      {!playing && <AperturePlayButton />}
    </div>
  );
}

/**
 * Signature interaction element: a segmented iris/aperture button, echoing
 * the blades in the Pictogram logo mark, instead of a generic triangle.
 * Blades rotate outward slightly on hover/tap to hint at "opening" the shot.
 */
function AperturePlayButton() {
  const blades = 6;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="group relative h-16 w-16">
        {Array.from({ length: blades }).map((_, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 h-8 w-4 origin-bottom rounded-t-full bg-white/90 transition-transform duration-300 ease-out group-hover:rotate-[8deg]"
            style={{
              transform: `translate(-50%, -100%) rotate(${(360 / blades) * i}deg)`,
            }}
          />
        ))}
        <span className="absolute inset-0 rounded-full bg-black/30 backdrop-blur-sm" />
        <svg
          className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  );
}
