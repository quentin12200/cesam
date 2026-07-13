interface BullHeadIconProps {
  size?: number;
  className?: string;
}

export default function BullHeadIcon({
  size = 24,
  className = "",
}: BullHeadIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 6C5.5 6 3.25 4.75 2 2.5c-.25 3.25 1.25 5.5 4.5 6" />
      <path d="M16 6c2.5 0 4.75-1.25 6-3.5.25 3.25-1.25 5.5-4.5 6" />
      <path d="M7 7.5 4.75 7 6 10" />
      <path d="m17 7.5 2.25-.5L18 10" />
      <path d="M8 6.25C7 8.5 7.25 13 8.5 16.5L10 20h4l1.5-3.5C16.75 13 17 8.5 16 6.25A8.5 8.5 0 0 0 12 5a8.5 8.5 0 0 0-4 1.25Z" />
      <path d="M9.5 11h.01M14.5 11h.01" />
      <path d="M9 16.5c1.75-1 4.25-1 6 0" />
      <path d="M10.5 18h.01M13.5 18h.01" />
    </svg>
  );
}
