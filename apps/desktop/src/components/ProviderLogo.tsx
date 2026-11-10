import { useEffect, useState } from 'react';
import anthropic from '@/assets/providers/anthropic.png';
import apinex from '@/assets/providers/apinex.jpg';
import cleanApis from '@/assets/providers/clean-apis.png';
import cloudflareWorkersAi from '@/assets/providers/cloudflare-workers-ai.png';
import custom from '@/assets/providers/custom-openai-compatible.png';
import deepseek from '@/assets/providers/deepseek.png';
import google from '@/assets/providers/google.png';
import groq from '@/assets/providers/groq.ico';
import inferx from '@/assets/providers/inferx.ico';
import kira from '@/assets/providers/kira-ai.png';
import mistral from '@/assets/providers/mistral.png';
import nvidia from '@/assets/providers/nvidia-build.ico';
import ollama from '@/assets/providers/ollama.png';
import openai from '@/assets/providers/openai.png';
import openrouter from '@/assets/providers/openrouter.ico';
import orcarouter from '@/assets/providers/orcarouter.ico';
import radeon from '@/assets/providers/radeon-cloud.ico';

const logos: Record<string, string> = {
  anthropic,
  apinex,
  'clean-apis': cleanApis,
  'cloudflare-workers-ai': cloudflareWorkersAi,
  'custom-openai-compatible': custom,
  deepseek,
  google,
  groq,
  inferx,
  'kira-ai': kira,
  mistral,
  'nvidia-build': nvidia,
  ollama,
  openai,
  openrouter,
  orcarouter,
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
