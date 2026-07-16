export default function HoofPrintIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10.8 2.8C7.1 4.1 4.7 7.5 4.8 11.8c.1 3.8 2 7 5.3 9.1.8.5 1.9-.1 1.9-1.1V4c0-.9-.5-1.5-1.2-1.2Z" />
      <path d="M13.2 2.8c3.7 1.3 6.1 4.7 6 9-.1 3.8-2 7-5.3 9.1-.8.5-1.9-.1-1.9-1.1V4c0-.9.5-1.5 1.2-1.2Z" />
    </svg>
  );
}
