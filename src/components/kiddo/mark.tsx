import { cn } from "@/lib/utils";

/**
 * PillarPath brand mark — the new futuristic cosmic logo.
 * Bold geometric "P" (pillar stem + orbit-ring bowl) in a neon
 * cyan→violet→magenta gradient with a lime sparkle, on a deep-space tile.
 */
export function PillarMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <defs>
        <linearGradient id="ph-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b1132" />
          <stop offset="1" stopColor="#04060e" />
        </linearGradient>
        <radialGradient id="ph-nebA" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ph-nebB" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ph-neon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#818cf8" />
          <stop offset="1" stopColor="#e879f9" />
        </linearGradient>
        <filter id="ph-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="36" />
        </filter>
        <clipPath id="ph-clip">
          <rect x="8" y="8" width="496" height="496" rx="116" />
        </clipPath>
      </defs>
      <g clipPath="url(#ph-clip)">
        <rect x="8" y="8" width="496" height="496" fill="url(#ph-bg)" />
        <ellipse cx="150" cy="118" rx="230" ry="190" fill="url(#ph-nebA)" />
        <ellipse cx="372" cy="412" rx="240" ry="200" fill="url(#ph-nebB)" />
        <g fill="#ffffff">
          <circle cx="92" cy="116" r="5" opacity="0.9" />
          <circle cx="428" cy="308" r="4" opacity="0.7" />
          <circle cx="104" cy="396" r="5" opacity="0.6" />
          <circle cx="64" cy="262" r="3" opacity="0.5" />
          <circle cx="452" cy="182" r="3" opacity="0.55" />
          <circle cx="204" cy="78" r="3" opacity="0.5" />
          <circle cx="332" cy="442" r="3" opacity="0.45" />
        </g>
        <ellipse
          cx="290"
          cy="252"
          rx="150"
          ry="145"
          fill="#22d3ee"
          opacity="0.16"
          filter="url(#ph-glow)"
        />
        <rect x="184" y="148" width="58" height="220" rx="29" fill="url(#ph-neon)" />
        <circle
          cx="298"
          cy="234"
          r="64"
          fill="none"
          stroke="url(#ph-neon)"
          strokeWidth="56"
        />
        <path
          d="M396 82 L404 104 L426 112 L404 120 L396 142 L388 120 L366 112 L388 104 Z"
          fill="#bef264"
        />
      </g>
    </svg>
  );
}
