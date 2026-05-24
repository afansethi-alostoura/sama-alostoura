export function SamaLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 400" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Building Icons */}
      {/* Orange/Yellow House (Left) */}
      <g>
        {/* Roof */}
        <path d="M 80 180 L 140 120 L 200 180" stroke="#FFA500" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Vertical lines (siding) */}
        <line x1="100" y1="180" x2="100" y2="280" stroke="#FFA500" strokeWidth="6" />
        <line x1="120" y1="180" x2="120" y2="280" stroke="#FFA500" strokeWidth="6" />
        <line x1="140" y1="180" x2="140" y2="280" stroke="#FFA500" strokeWidth="6" />
        <line x1="160" y1="180" x2="160" y2="280" stroke="#FFA500" strokeWidth="6" />
        <line x1="180" y1="180" x2="180" y2="280" stroke="#FFA500" strokeWidth="6" />
      </g>

      {/* Blue Skyscraper (Right, overlapping) */}
      <g>
        {/* Roof */}
        <path d="M 160 140 L 220 80 L 280 140" stroke="#0066CC" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Vertical lines (siding) */}
        <line x1="180" y1="140" x2="180" y2="280" stroke="#0066CC" strokeWidth="6" />
        <line x1="200" y1="140" x2="200" y2="280" stroke="#0066CC" strokeWidth="6" />
        <line x1="220" y1="140" x2="220" y2="280" stroke="#0066CC" strokeWidth="6" />
        <line x1="240" y1="140" x2="240" y2="280" stroke="#0066CC" strokeWidth="6" />
        <line x1="260" y1="140" x2="260" y2="280" stroke="#0066CC" strokeWidth="6" />
      </g>

      {/* Text: SAMA ALOSTOURA */}
      <text x="320" y="150" fontSize="72" fontWeight="bold" fill="#0066CC" fontFamily="Arial, sans-serif" letterSpacing="2">
        SAMA
      </text>
      <text x="320" y="230" fontSize="72" fontWeight="bold" fill="#0066CC" fontFamily="Arial, sans-serif" letterSpacing="2">
        ALOSTOURA
      </text>
      <text x="320" y="300" fontSize="48" fontWeight="bold" fill="#0066CC" fontFamily="Arial, sans-serif" letterSpacing="1">
        BUILDING CONTRACTING L.L.C
      </text>

      {/* Arabic Text */}
      <text x="320" y="350" fontSize="32" fill="#FFA500" fontFamily="Arial, sans-serif" direction="rtl" textAnchor="start">
        سماء الاسطورة لمقاولات البناء ش.ذ.م.م
      </text>
    </svg>
  )
}

export function SamaLogoSmall({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 80" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Orange/Yellow House (Left) */}
      <g>
        <path d="M 10 45 L 25 30 L 40 45" stroke="#FFA500" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="45" x2="16" y2="65" stroke="#FFA500" strokeWidth="1.5" />
        <line x1="22" y1="45" x2="22" y2="65" stroke="#FFA500" strokeWidth="1.5" />
        <line x1="28" y1="45" x2="28" y2="65" stroke="#FFA500" strokeWidth="1.5" />
        <line x1="34" y1="45" x2="34" y2="65" stroke="#FFA500" strokeWidth="1.5" />
      </g>

      {/* Blue Skyscraper (Right) */}
      <g>
        <path d="M 35 35 L 50 20 L 65 35" stroke="#0066CC" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="41" y1="35" x2="41" y2="65" stroke="#0066CC" strokeWidth="1.5" />
        <line x1="47" y1="35" x2="47" y2="65" stroke="#0066CC" strokeWidth="1.5" />
        <line x1="53" y1="35" x2="53" y2="65" stroke="#0066CC" strokeWidth="1.5" />
        <line x1="59" y1="35" x2="59" y2="65" stroke="#0066CC" strokeWidth="1.5" />
      </g>

      {/* Text: SAMA */}
      <text x="70" y="48" fontSize="16" fontWeight="bold" fill="#0066CC" fontFamily="Arial, sans-serif" letterSpacing="1">
        SAMA
      </text>
    </svg>
  )
}
