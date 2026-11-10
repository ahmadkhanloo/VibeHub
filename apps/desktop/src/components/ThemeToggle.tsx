import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/app/settings';

/* Animated day/night switch, adapted from Hamzeh Ghoreyshi's MIT-licensed
   "interactive-day-night-toggle" (github.com/HamzehGhoreyshi/interactive-day-night-toggle).
   The scene is re-implemented in React with every class scoped under .vh-daynight so the
   generic layer names (.sun, .moon, .star, .pill) cannot collide with app styles. */

const STARS = [
  { x: 70, y: 70, scale: 7, t: '3.2s' },
  { x: 160, y: 92, scale: 5, t: '2.6s' },
  { x: 232, y: 72, scale: 6, t: '3.8s' },
  { x: 250, y: 160, scale: 8, t: '3.1s' },
  { x: 120, y: 175, scale: 5, t: '2.9s' },
];
const DOTS = [
  { x: 48, y: 130, r: 2.4, t: '2.2s' },
  { x: 110, y: 40, r: 1.8, t: '2.7s' },
  { x: 200, y: 130, r: 2.2, t: '3.4s' },
  { x: 296, y: 108, r: 1.6, t: '2.4s' },
  { x: 180, y: 205, r: 1.8, t: '3s' },
  { x: 82, y: 205, r: 1.6, t: '2.5s' },
  { x: 288, y: 45, r: 1.4, t: '3.6s' },
];

const CLOUDS = [
  [[230, 232, 42], [310, 205, 48], [388, 172, 54], [462, 110, 70], [528, 48, 72], [480, 262, 100], [540, 150, 60]],
  [[180, 248, 40], [262, 228, 44], [345, 212, 46], [428, 180, 54], [505, 118, 66], [548, 62, 58], [500, 252, 90]],
  [[118, 268, 42], [200, 254, 42], [285, 246, 44], [370, 238, 46], [452, 208, 52], [530, 150, 66], [510, 262, 85]],
];

export function ThemeToggle() {
  const { t } = useTranslation(['ux']);
  const { resolvedMode, update } = useSettings();
  const knob = useRef<HTMLSpanElement>(null);
  const night = resolvedMode === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={night}
      aria-label={t('ux:themeToggle')}
      title={t(night ? 'ux:nightMode' : 'ux:dayMode')}
      className="vh-daynight"
      data-night={night || undefined}
      onClick={() => {
        // An explicit choice leaves "follow the system" mode, which is what the switch promises.
        update({ themeMode: night ? 'light' : 'dark' });
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          knob.current?.animate([
            { transform: 'scale(1, 1)' },
            { transform: 'scale(1.14, .88)', offset: 0.25 },
            { transform: 'scale(.94, 1.06)', offset: 0.55 },
            { transform: 'scale(1.02, .98)', offset: 0.75 },
            { transform: 'scale(1, 1)' },
          ], { duration: 800, easing: 'ease-out' });
        }
      }}
    >
      <span className="vh-dn-pill" aria-hidden="true">
        <span className="vh-dn-sky" />
        <svg className="vh-dn-layer vh-dn-stars" viewBox="0 0 530 243">
          {STARS.map((star, index) => (
            <g key={`s${index}`} transform={`translate(${star.x} ${star.y}) scale(${star.scale})`}>
              <g className="vh-dn-star" style={{ '--i': index, '--t': star.t } as React.CSSProperties}>
                <path d="M0 -1 Q0.12 -0.12 1 0 Q0.12 0.12 0 1 Q-0.12 0.12 -1 0 Q-0.12 -0.12 0 -1Z" />
              </g>
            </g>
          ))}
          {DOTS.map((dot, index) => (
            <g key={`d${index}`} transform={`translate(${dot.x} ${dot.y})`}>
              <g className="vh-dn-star" style={{ '--i': index + STARS.length, '--t': dot.t } as React.CSSProperties}>
                <circle r={dot.r} />
              </g>
            </g>
          ))}
        </svg>
        <span className="vh-dn-shooting" />
        <span className="vh-dn-knob-track">
          <span className="vh-dn-halo" />
          <span className="vh-dn-knob" ref={knob}>
            <span className="vh-dn-sun" />
            <span className="vh-dn-moon">
              <span className="vh-dn-crater vh-dn-c1" />
              <span className="vh-dn-crater vh-dn-c2" />
              <span className="vh-dn-crater vh-dn-c3" />
            </span>
          </span>
        </span>
        {CLOUDS.map((circles, layer) => (
          <svg key={`c${layer}`} className={`vh-dn-layer vh-dn-cloud vh-dn-cloud-${layer + 1}`} viewBox="0 0 530 243">
            <g>{circles.map(([cx, cy, r], index) => <circle key={index} cx={cx} cy={cy} r={r} />)}</g>
          </svg>
        ))}
      </span>
    </button>
  );
}
