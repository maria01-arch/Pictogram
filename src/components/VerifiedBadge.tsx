export default function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="inline-block shrink-0 align-middle"
      aria-label="Verified"
      role="img"
    >
      {/* 8-point scalloped seal */}
      <path
        d="M12 1.5l2.34 1.87 2.94-.53 1.14 2.76 2.76 1.14-.53 2.94L22.5 12l-1.85 2.32.53 2.94-2.76 1.14-1.14 2.76-2.94-.53L12 22.5l-2.34-1.87-2.94.53-1.14-2.76-2.76-1.14.53-2.94L1.5 12l1.85-2.32-.53-2.94 2.76-1.14 1.14-2.76 2.94.53z"
        fill="#2547F4"
      />
      <path
        d="M8.5 12.2l2.4 2.4 4.6-5.4"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
