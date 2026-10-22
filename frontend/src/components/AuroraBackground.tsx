import { memo } from 'react';

/**
 * AuroraBackground
 * A global, high-performance animated background inspired by flowing aurora borealis lights
 * and interconnected luminous beams.
 * 
 * - Rendered once in the global layout
 * - Fixed positioning behind all page content (pointer-events: none)
 * - GPU-accelerated CSS keyframe animations (transforms and opacity)
 * - Derived from reSide's brand colors (Sapphire, Electric Blue, Cyan, Emerald, Indigo)
 * - Separate tuned intensity for Light and Dark modes
 * - Full support for prefers-reduced-motion
 */
export const AuroraBackground = memo(function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* Dynamic Aurora Ambient Light Fields */}
      <div className="aurora-orb aurora-orb-1" />
      <div className="aurora-orb aurora-orb-2" />
      <div className="aurora-orb aurora-orb-3" />
      <div className="aurora-orb aurora-orb-4" />
      <div className="aurora-orb aurora-orb-5" />

      {/* Interconnected Luminous Light Beams & Flowing Ribbons */}
      <svg
        className="aurora-beams-svg absolute inset-0 h-full w-full opacity-60 dark:opacity-80"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
      >
        <defs>
          {/* Ribbon 1: Royal Blue to Bright Teal */}
          <linearGradient id="auroraBeamGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
            <stop offset="25%" stopColor="#3b82f6" stopOpacity="0.38" />
            <stop offset="65%" stopColor="#14b8a6" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>

          {/* Ribbon 2: Electric Indigo to Sky Blue */}
          <linearGradient id="auroraBeamGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0" />
            <stop offset="35%" stopColor="#0ea5e9" stopOpacity="0.42" />
            <stop offset="75%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>

          {/* Ribbon 3: Luminous Cyan to Emerald */}
          <linearGradient id="auroraBeamGrad3" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0" />
            <stop offset="30%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="70%" stopColor="#22c55e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>

          {/* Soft Glow Filter */}
          <filter id="auroraGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Primary flowing aurora ribbons */}
        <path
          d="M-80,240 C220,130 460,380 820,250 C1160,120 1340,320 1620,240"
          fill="none"
          stroke="url(#auroraBeamGrad1)"
          strokeWidth="3.5"
          filter="url(#auroraGlow)"
          className="aurora-beam aurora-beam-1"
        />
        <path
          d="M-60,640 C320,510 640,730 1000,570 C1300,430 1460,670 1660,560"
          fill="none"
          stroke="url(#auroraBeamGrad2)"
          strokeWidth="3"
          filter="url(#auroraGlow)"
          className="aurora-beam aurora-beam-2"
        />
        <path
          d="M120,-60 C380,280 540,160 860,490 C1140,740 1400,520 1560,940"
          fill="none"
          stroke="url(#auroraBeamGrad3)"
          strokeWidth="2.5"
          filter="url(#auroraGlow)"
          className="aurora-beam aurora-beam-3"
        />

        {/* Delicate interconnected constellation nodes */}
        <circle cx="820" cy="250" r="4.5" fill="#38bdf8" opacity="0.65" className="aurora-node aurora-node-pulse-1" />
        <circle cx="1000" cy="570" r="4.5" fill="#2dd4bf" opacity="0.65" className="aurora-node aurora-node-pulse-2" />
        <circle cx="460" cy="380" r="3.5" fill="#60a5fa" opacity="0.55" className="aurora-node aurora-node-pulse-3" />
        <circle cx="860" cy="490" r="4" fill="#34d399" opacity="0.55" className="aurora-node aurora-node-pulse-1" />
      </svg>

      {/* Subtle atmospheric vignette and highlight veil */}
      <div className="aurora-vignette absolute inset-0" />
    </div>
  );
});

export default AuroraBackground;
