interface BrandLogoProps {
  size?: number;
  variant?: 'gold-on-dark' | 'emerald-on-light';
}

export function BrandLogo({ size = 40, variant = 'gold-on-dark' }: BrandLogoProps) {
  const bg = variant === 'gold-on-dark' ? '#0D4A2E' : '#083320';
  const stroke = variant === 'gold-on-dark' ? '#DFB848' : '#C59B27';
  const accent = variant === 'gold-on-dark' ? '#FFFFFF' : '#F8FAF8';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="Logo KSP Cendana Artha Mandiri"
    >
      <rect width="48" height="48" rx="12" fill={bg} />
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="10.5"
        stroke={stroke}
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      {/* Shield / Pillar Frame */}
      <path
        d="M24 8L37 13.5V23.5C37 31.4 31.4 38.2 24 40.5C16.6 38.2 11 31.4 11 23.5V13.5L24 8Z"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Cendana Stylized Tree & Prosperity Arc */}
      <path
        d="M24 14.5V33"
        stroke={accent}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M24 21C20.5 21 17.5 18.8 16.5 15.5C19.8 15.5 22.8 17.5 24 21Z"
        fill={stroke}
      />
      <path
        d="M24 21C27.5 21 30.5 18.8 31.5 15.5C28.2 15.5 25.2 17.5 24 21Z"
        fill={stroke}
      />
      <path
        d="M24 27.5C20 27.5 16.8 25.2 15.8 21.8C19.2 21.8 22.5 23.9 24 27.5Z"
        fill={accent}
        fillOpacity="0.9"
      />
      <path
        d="M24 27.5C28 27.5 31.2 25.2 32.2 21.8C28.8 21.8 25.5 23.9 24 27.5Z"
        fill={accent}
        fillOpacity="0.9"
      />
    </svg>
  );
}
