import { useEffect, useState } from 'react';
import anthropic from '@/assets/providers/anthropic.png';
import cloudflareWorkersAi from '@/assets/providers/cloudflare-workers-ai.png';
import custom from '@/assets/providers/custom-openai-compatible.png';
import google from '@/assets/providers/google.png';
import groq from '@/assets/providers/groq.ico';
import nvidia from '@/assets/providers/nvidia-build.ico';
import openai from '@/assets/providers/openai.png';
import openrouter from '@/assets/providers/openrouter.ico';
import radeon from '@/assets/providers/radeon-cloud.ico';

// Anthropic and OpenAI keep logos: their manifests still back the Claude presets
// and the custom fills, even though they are no longer catalogue rows.
const logos: Record<string, string> = {
  anthropic,
  'cloudflare-workers-ai': cloudflareWorkersAi,
  'custom-openai-compatible': custom,
  google,
  groq,
  'nvidia-build': nvidia,
  openai,
  openrouter,
  'radeon-cloud': radeon,
};

export function ProviderLogo({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  const logo = logos[id];
  return <span className="vh-provider-logo" aria-hidden="true">
    {logo && !failed ? <img src={logo} alt="" onError={() => setFailed(true)} /> : <span>{name.trim().slice(0, 2).toLocaleUpperCase()}</span>}
  </span>;
}
