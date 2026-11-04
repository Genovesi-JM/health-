/* KAYA spot illustrations — small flat, warm, Kasa-style scenes with a soft
   blob, used in place of generic icons across the landing. Designed to glow on
   the dark cinematic sections (light + teal fills on a tinted blob). */
import type { ReactNode } from 'react';

export type SpotName =
  | 'family' | 'professional' | 'prescription' | 'ambulance'
  | 'accessible' | 'scheduled' | 'assisted' | 'emergency'
  | 'telehealth' | 'hospital' | 'company' | 'chronic';

const CREAM = '#f7f4ec';
const TEAL = '#14b8a6';
const FOREST = '#0f766e';
const MINT = '#5eead4';
const GOLD = '#e7b94f';
const RED = '#ef4444';
const WIN = '#bfe9df';

function Frame({ children, tone = TEAL }: { children: ReactNode; tone?: string }) {
  return (
    <svg className="kaya-spot" viewBox="0 0 96 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="48" cy="40" r="33" fill={tone} opacity="0.15" />
      {children}
    </svg>
  );
}

function Heart({ x, y, s = 1, fill = RED }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="-4" cy="-1" r="4" fill={fill} />
      <circle cx="4" cy="-1" r="4" fill={fill} />
      <path d="M-7.6 1 L0 10 L7.6 1 Z" fill={fill} />
    </g>
  );
}

export default function Spot({ name }: { name: SpotName }) {
  switch (name) {
    case 'family':
      return (
        <Frame>
          <path d="M30 45 L48 30 L66 45 Z" fill={FOREST} />
          <rect x="35" y="45" width="26" height="22" rx="4" fill={CREAM} />
          <rect x="44" y="53" width="8" height="14" rx="2" fill={FOREST} />
          <rect x="38" y="49" width="6" height="6" rx="1.5" fill={WIN} />
          <Heart x={62} y={30} s={0.8} />
        </Frame>
      );
    case 'professional':
      return (
        <Frame>
          {/* stethoscope */}
          <path d="M34 28 v10 a8 8 0 0 0 16 0 v-10" fill="none" stroke={CREAM} strokeWidth="3" strokeLinecap="round" />
          <circle cx="34" cy="27" r="3" fill={MINT} />
          <circle cx="50" cy="27" r="3" fill={MINT} />
          <path d="M42 46 v6 a9 9 0 0 0 18 0" fill="none" stroke={CREAM} strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="50" r="7" fill={TEAL} />
          <circle cx="60" cy="50" r="3" fill={CREAM} />
        </Frame>
      );
    case 'prescription':
      return (
        <Frame>
          <rect x="30" y="26" width="36" height="34" rx="5" fill={CREAM} />
          <text x="37" y="40" fontFamily="Georgia, serif" fontSize="11" fontWeight="700" fill={FOREST}>Rx</text>
          <rect x="36" y="44" width="24" height="3.4" rx="1.7" fill="#cfe0d8" />
          <rect x="36" y="51" width="16" height="3.4" rx="1.7" fill="#d9d3c4" />
          <circle cx="62" cy="56" r="8" fill={TEAL} />
          <path d="M58.5 56 l2.5 2.6 l4.2 -5" fill="none" stroke={CREAM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Frame>
      );
    case 'ambulance':
      return (
        <Frame tone={TEAL}>
          <rect x="26" y="38" width="44" height="22" rx="5" fill={CREAM} />
          <path d="M56 40 h8 q6 0 8 6 l2 6 q1 4 -4 4 h-14 Z" fill="#eaf4f0" />
          <rect x="58" y="44" width="11" height="8" rx="2" fill={WIN} />
          <rect x="35" y="44" width="3" height="10" rx="1.5" fill={RED} />
          <rect x="31.5" y="47.5" width="10" height="3" rx="1.5" fill={RED} />
          <rect x="26" y="52" width="48" height="4" fill={TEAL} />
          <rect x="34" y="32" width="10" height="6" rx="2" fill={RED} />
          <circle cx="37" cy="62" r="5.5" fill="#123" /><circle cx="37" cy="62" r="2" fill={MINT} />
          <circle cx="63" cy="62" r="5.5" fill="#123" /><circle cx="63" cy="62" r="2" fill={MINT} />
        </Frame>
      );
    case 'accessible':
      return (
        <Frame>
          <circle cx="40" cy="30" r="5" fill={MINT} />
          <path d="M40 36 v10 h14" fill="none" stroke={CREAM} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M40 40 h10" fill="none" stroke={CREAM} strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="44" cy="54" r="12" fill="none" stroke={CREAM} strokeWidth="3" />
          <circle cx="44" cy="54" r="3" fill={TEAL} />
          <path d="M54 46 l5 9" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="58" r="3.4" fill={GOLD} />
        </Frame>
      );
    case 'scheduled':
      return (
        <Frame tone={MINT}>
          <rect x="24" y="40" width="40" height="20" rx="5" fill={CREAM} />
          <path d="M52 42 h6 q5 0 7 5 l1.5 5 q1 4 -4 4 h-10.5 Z" fill="#eaf4f0" />
          <rect x="54" y="45" width="9" height="7" rx="2" fill={WIN} />
          <rect x="24" y="53" width="44" height="4" fill={TEAL} />
          <circle cx="34" cy="62" r="5" fill="#123" /><circle cx="58" cy="62" r="5" fill="#123" />
          {/* clock badge */}
          <circle cx="60" cy="30" r="10" fill={GOLD} />
          <path d="M60 25 v5 l4 3" fill="none" stroke="#5a4414" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </Frame>
      );
    case 'assisted':
      return (
        <Frame>
          {/* stretcher */}
          <rect x="24" y="42" width="48" height="9" rx="4.5" fill={CREAM} />
          <rect x="26" y="37" width="15" height="7" rx="3" fill={WIN} />
          <path d="M28 51 v8 M68 51 v8" stroke={CREAM} strokeWidth="3" strokeLinecap="round" />
          <circle cx="28" cy="62" r="4.5" fill="#123" /><circle cx="68" cy="62" r="4.5" fill="#123" />
          {/* cross badge */}
          <circle cx="56" cy="32" r="9" fill={TEAL} />
          <rect x="54.4" y="27" width="3.2" height="10" rx="1.4" fill={CREAM} />
          <rect x="51" y="30.4" width="10" height="3.2" rx="1.4" fill={CREAM} />
        </Frame>
      );
    case 'emergency':
      return (
        <Frame tone={RED}>
          <rect x="26" y="40" width="44" height="20" rx="5" fill={CREAM} />
          <rect x="30" y="34" width="11" height="7" rx="2.5" fill={RED} />
          <rect x="26" y="53" width="48" height="4" fill={RED} />
          {/* pulse across body */}
          <path d="M32 50 h6 l3 -8 l5 14 l3 -6 h12" fill="none" stroke={FOREST} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="37" cy="62" r="5.5" fill="#123" /><circle cx="37" cy="62" r="2" fill={MINT} />
          <circle cx="63" cy="62" r="5.5" fill="#123" /><circle cx="63" cy="62" r="2" fill={MINT} />
        </Frame>
      );
    case 'telehealth':
      return (
        <Frame>
          {/* phone screen with a clinician + video dot */}
          <rect x="30" y="22" width="36" height="42" rx="7" fill={CREAM} />
          <rect x="34" y="27" width="28" height="26" rx="4" fill="#0e3a32" />
          <circle cx="48" cy="36" r="5" fill={MINT} />
          <path d="M42 48 a6 6 0 0 1 12 0" fill={MINT} />
          <circle cx="48" cy="59" r="2" fill={FOREST} />
          {/* video bubble */}
          <circle cx="64" cy="26" r="8" fill={TEAL} />
          <path d="M60 23 v6 l5 -3 Z" fill={CREAM} />
        </Frame>
      );
    case 'hospital':
      return (
        <Frame>
          <rect x="30" y="34" width="36" height="32" rx="5" fill={CREAM} />
          <rect x="37" y="24" width="22" height="12" rx="3" fill={FOREST} />
          <rect x="46.4" y="26" width="3.2" height="8" rx="1.4" fill={CREAM} />
          <rect x="43" y="28.4" width="10" height="3.2" rx="1.4" fill={CREAM} />
          <g fill={WIN}>
            <rect x="35" y="40" width="8" height="8" rx="2" /><rect x="53" y="40" width="8" height="8" rx="2" />
            <rect x="35" y="52" width="8" height="8" rx="2" /><rect x="53" y="52" width="8" height="8" rx="2" />
          </g>
          <rect x="44" y="54" width="8" height="12" rx="2" fill={TEAL} />
        </Frame>
      );
    case 'company':
      return (
        <Frame tone={MINT}>
          <rect x="28" y="30" width="24" height="34" rx="4" fill={CREAM} />
          <rect x="50" y="38" width="20" height="26" rx="4" fill="#eadfcb" />
          <g fill={WIN}>
            <rect x="32" y="35" width="6" height="6" rx="1.5" /><rect x="42" y="35" width="6" height="6" rx="1.5" />
            <rect x="32" y="45" width="6" height="6" rx="1.5" /><rect x="42" y="45" width="6" height="6" rx="1.5" />
            <rect x="55" y="43" width="5" height="5" rx="1.2" /><rect x="62" y="43" width="5" height="5" rx="1.2" />
          </g>
          <circle cx="40" cy="27" r="4" fill={TEAL} />
          <circle cx="60" cy="33" r="3.4" fill={GOLD} />
        </Frame>
      );
    case 'chronic':
      return (
        <Frame>
          <Heart x={48} y={36} s={1.9} fill={CREAM} />
          <path d="M28 40 h9 l4 -9 l6 18 l4 -9 h17" fill="none" stroke={TEAL} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="68" cy="31" r="3.4" fill={RED}>
            <animate attributeName="r" values="3;4.4;3" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </Frame>
      );
    default:
      return <Frame><circle cx="48" cy="40" r="10" fill={TEAL} /></Frame>;
  }
}
