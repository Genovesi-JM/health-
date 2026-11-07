/* Custom illustrative scene for the KAYA hero: the journey to care —
   home → route → clinic, with an ambulance and an e-prescription.
   Flat, warm, editorial (Kasa-inspired), glowing on the dark hero.
   Not iconography — a small illustrated world. */
export default function CareJourneyScene() {
  return (
    <svg className="kaya-scene" viewBox="0 0 520 440" role="img"
      aria-label="Casa ligada a uma clínica por uma rota, com ambulância, receita digital e sinais de cuidado"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="scGlow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.32" />
          <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="scRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f766e" /><stop offset="100%" stopColor="#0b5a53" />
        </linearGradient>
        <linearGradient id="scClinic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7f4ec" /><stop offset="100%" stopColor="#e9e2d1" />
        </linearGradient>
        <filter id="scSoft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#02110f" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* glow backdrop */}
      <ellipse cx="260" cy="190" rx="250" ry="180" fill="url(#scGlow)" />

      {/* route: home → clinic (animated dash flow) */}
      <path d="M120 300 C 190 250, 210 210, 268 214 S 360 250, 404 206"
        fill="none" stroke="#5eead4" strokeOpacity="0.55" strokeWidth="3.5"
        strokeDasharray="2 12" strokeLinecap="round">
        <animate attributeName="stroke-dashoffset" from="0" to="-140" dur="3.2s" repeatCount="indefinite" />
      </path>
      <circle r="5" fill="#5eead4">
        <animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1"
          path="M120 300 C 190 250, 210 210, 268 214 S 360 250, 404 206" />
      </circle>

      {/* ───── HOME (left) ───── */}
      <g filter="url(#scSoft)">
        <rect x="74" y="286" width="104" height="78" rx="12" fill="#f7f4ec" />
        <path d="M66 290 L126 250 L186 290 Z" fill="url(#scRoof)" />
        <rect x="92" y="312" width="26" height="26" rx="5" fill="#bfe9df" />
        <rect x="134" y="312" width="24" height="52" rx="5" fill="#0f766e" />
        <circle cx="152" cy="340" r="2.6" fill="#f7f4ec" />
      </g>
      {/* sprout */}
      <path d="M70 366 q6 -12 16 -10 q-4 10 -16 10" fill="#7bbf9f" opacity="0.9" />

      {/* ───── CLINIC (right) with care cross ───── */}
      <g filter="url(#scSoft)">
        <rect x="356" y="266" width="104" height="98" rx="12" fill="url(#scClinic)" />
        {/* cross badge */}
        <rect x="392" y="238" width="32" height="32" rx="9" fill="#0f766e" />
        <rect x="406" y="245" width="4" height="18" rx="2" fill="#f7f4ec" />
        <rect x="399" y="252" width="18" height="4" rx="2" fill="#f7f4ec" />
        {/* windows */}
        <g fill="#bfe9df">
          <rect x="372" y="288" width="20" height="20" rx="4" />
          <rect x="400" y="288" width="20" height="20" rx="4" />
          <rect x="428" y="288" width="20" height="20" rx="4" />
          <rect x="372" y="316" width="20" height="20" rx="4" />
          <rect x="428" y="316" width="20" height="20" rx="4" />
        </g>
        <rect x="400" y="334" width="20" height="30" rx="4" fill="#0f766e" />
      </g>

      {/* ───── AMBULANCE on the route (gentle bob) ───── */}
      <g filter="url(#scSoft)">
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -5; 0 0" dur="2.6s" repeatCount="indefinite" />
        <g transform="translate(224 150)">
          <rect x="0" y="12" width="78" height="40" rx="9" fill="#ffffff" />
          <path d="M58 16 h12 q10 0 14 10 l4 10 q1 6 -6 6 h-24 Z" fill="#eef7f4" />
          <rect x="60" y="22" width="18" height="13" rx="3" fill="#bfe9df" />
          {/* red cross */}
          <rect x="22" y="24" width="4.5" height="16" rx="2" fill="#ef4444" />
          <rect x="16" y="30" width="16" height="4.5" rx="2" fill="#ef4444" />
          {/* teal stripe */}
          <rect x="0" y="40" width="96" height="6" fill="#14b8a6" />
          {/* beacon */}
          <rect x="20" y="4" width="16" height="9" rx="3" fill="#ef4444">
            <animate attributeName="opacity" values="1;.3;1" dur="1s" repeatCount="indefinite" />
          </rect>
          {/* wheels */}
          <circle cx="22" cy="54" r="9" fill="#123" /><circle cx="22" cy="54" r="4" fill="#9fb" opacity=".5" />
          <circle cx="74" cy="54" r="9" fill="#123" /><circle cx="74" cy="54" r="4" fill="#9fb" opacity=".5" />
        </g>
      </g>

      {/* ───── e-PRESCRIPTION chip (floats near home) ───── */}
      <g filter="url(#scSoft)">
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -6; 0 0" dur="3.4s" repeatCount="indefinite" />
        <g transform="translate(40 150)">
          <rect x="0" y="0" width="118" height="70" rx="12" fill="#ffffff" />
          <circle cx="22" cy="24" r="12" fill="#e6f7f2" />
          <text x="22" y="29" textAnchor="middle" fontFamily="Georgia, serif" fontSize="14" fontWeight="700" fill="#0f766e">Rx</text>
          <rect x="42" y="16" width="60" height="6" rx="3" fill="#cfe9e1" />
          <rect x="42" y="30" width="44" height="6" rx="3" fill="#e2ded0" />
          <rect x="12" y="48" width="70" height="7" rx="3.5" fill="#eef1ea" />
          <circle cx="98" cy="51" r="11" fill="#14b8a6" />
          <path d="M93 51 l4 4 l7 -8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>

      {/* ───── pulse chip (near clinic) ───── */}
      <g filter="url(#scSoft)">
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -7; 0 0" dur="3.9s" repeatCount="indefinite" />
        <g transform="translate(372 150)">
          <rect x="0" y="0" width="112" height="56" rx="12" fill="#0e3a32" />
          <path d="M14 30 h16 l6 -14 l10 28 l7 -14 h20" fill="none" stroke="#5eead4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="92" cy="20" r="7" fill="#5eead4" opacity="0.9">
            <animate attributeName="r" values="6;8;6" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </g>
      </g>
    </svg>
  );
}
