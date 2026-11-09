import { useState, useEffect } from 'react';
import zcodeLogo from '@/assets/apps/zcode.png';
import qoderLogo from '@/assets/apps/qoder.png';
import deepseekLogo from '@/assets/apps/deepseek.png';
import freebuffLogo from '@/assets/apps/freebuff.png';
import mimoLogo from '@/assets/apps/mimocode.png';
import opencodeLogo from '@/assets/apps/opencode.png';
import antigravityLogo from '@/assets/apps/antigravity.png';
import claudeLogo from '@/assets/apps/claude.png';
import chatgptLogo from '@/assets/apps/chatgpt.svg';
import { AppWindow } from 'lucide-react';

const logos: Record<string, string> = {
  zcode: zcodeLogo,
  qoder: qoderLogo,
  'deepseek-harness': deepseekLogo,
  freebuff: freebuffLogo,
  mimocode: mimoLogo,
  opencode: opencodeLogo,
  'antigravity-ide': antigravityLogo,
  'claude-code': claudeLogo,
  'claude-desktop': claudeLogo,
  chatgpt: chatgptLogo,
};

export function AppLogo({ appId, name, size = 44, rtl = false }: { appId: string; name: string; size?: number; rtl?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [appId]);
  const darkBackground = ['opencode', 'freebuff', 'mimocode', 'antigravity-ide'].includes(appId);
  const logo = logos[appId];

  return (
    <span
      aria-hidden="true"
      className={`vh-app-logo ${rtl ? 'vh-app-logo-rtl' : ''} ${darkBackground ? 'vh-app-logo-dark' : ''}`}
      style={{ width: size, height: size }}
    >
      {logo && !failed ? (
        <img src={logo} alt="" onError={() => setFailed(true)} className="h-full w-full object-contain" />
      ) : (
        <AppWindow size={24} aria-hidden="true" />
      )}
      {rtl && <span className="vh-rtl-mark">RTL</span>}
    </span>
  );
}
