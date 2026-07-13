interface CalvingIconProps {
  size?: number;
  className?: string;
}

export default function CalvingIcon({
  size = 24,
  className = "",
}: CalvingIconProps) {
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
      <path d="M6.5 5.5h10.25A2.25 2.25 0 0 1 19 7.75v3.75H7.5A1.5 1.5 0 0 1 6 10V7" />
      <path d="M6.5 6 5 4.5H2.75v4.75H6" />
      <path d="m3.25 4.5-1-1.25M5 4.5l1-1.25" />
      <path d="M9 11.5v2.25M17 11.5v2.25M19 7.5l2-1.25v3" />
      <path d="M11.5 15.25h7.25A2.25 2.25 0 0 1 21 17.5v1.25h-9.5A1.5 1.5 0 0 1 10 17.25V16.5" />
      <path d="m10 16.25-1-1H7.25v3.25H10" />
      <path d="M13 18.75v2M19 18.75v2M21 17l1-1" />
    </svg>
  );
}
