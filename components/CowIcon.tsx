export default function CowIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Cornes */}
      <path d="M7 5 L5 2" />
      <path d="M11 5 L13 2" />
      {/* Tête */}
      <ellipse cx="9" cy="8" rx="4" ry="3.5" />
      {/* Corps */}
      <path d="M12 7 H20 A2 2 0 0 1 22 9 V14 A2 2 0 0 1 20 16 H14 A2 2 0 0 1 12 14 Z" />
      {/* Patte avant gauche */}
      <line x1="14" y1="16" x2="13" y2="21" />
      {/* Patte arrière gauche */}
      <line x1="17" y1="16" x2="17" y2="21" />
      {/* Queue */}
      <path d="M22 11 Q24 9 23 14" />
      {/* Pis */}
      <path d="M14 16 Q16 19 18 16" />
    </svg>
  );
}
