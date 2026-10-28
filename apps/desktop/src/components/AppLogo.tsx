import { useState, useEffect } from 'react';
import zcodeLogo from '@/assets/apps/zcode.png';
import qoderLogo from '@/assets/apps/qoder.png';
import deepseekLogo from '@/assets/apps/deepseek.png';
import freebuffLogo from '@/assets/apps/freebuff.png';
import mimoLogo from '@/assets/apps/mimocode.png';
import opencodeLogo from '@/assets/apps/opencode.png';
import antigravityLogo from '@/assets/apps/antigravity.png';
import chatgptLogo from '@/assets/apps/chatgpt.svg';
import { AppWindow } from 'lucide-react';

const logos: Record<string, string> = {
  zcode: zcodeLogo,
  qoder: qoderLogo,
  'deepseek-harness': deepseekLogo,
  freebuff: freebuffLogo,
  mimocode: mimoLogo,
  opencode: opencodeLogo,
  antigravity: antigravityLogo,
  chatgpt: chatgptLogo,
};

export function AppLogo({ appId, name, size = 44 }: { appId: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [appId]);
  const darkBackground = ['opencode', 'freebuff', 'mimocode', 'antigravity'].includes(appId);
  const logo = logos[appId];

  return (
    <span
      aria-hidden="true"
      className={`vh-app-logo ${darkBackground ? 'vh-app-logo-dark' : ''}`}
      style={{ width: size, height: size }}
    >
      {logo && !failed ? (
        <img src={logo} alt="" onError={() => setFailed(true)} className="h-full w-full object-contain" />
      ) : (
        <AppWindow size={24} aria-hidden="true" />
      )}
    </span>
  );
}
