import { useState } from 'react';
import zcodeLogo from '@/assets/apps/zcode.png';
import qoderLogo from '@/assets/apps/qoder.png';
import deepseekLogo from '@/assets/apps/deepseek.png';
import freebuffLogo from '@/assets/apps/freebuff.png';
import mimoLogo from '@/assets/apps/mimocode.png';
import opencodeLogo from '@/assets/apps/opencode.png';

const logos: Record<string, string> = {
  zcode: zcodeLogo,
  qoder: qoderLogo,
  'deepseek-harness': deepseekLogo,
  freebuff: freebuffLogo,
  mimocode: mimoLogo,
  opencode: opencodeLogo,
};

export function AppLogo({ appId, name, size = 44 }: { appId: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const darkBackground = appId === 'opencode';
  const logo = logos[appId];

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-[13px] border border-border/70 p-1.5 ${darkBackground ? 'bg-[#171717]' : 'bg-white'}`}
      style={{ width: size, height: size }}
    >
      {logo && !failed ? (
        <img src={logo} alt="" onError={() => setFailed(true)} className="h-full w-full object-contain" />
      ) : (
        <span className="text-sm font-bold text-[#1b1f24]">{name.slice(0, 1)}</span>
      )}
    </span>
  );
}
