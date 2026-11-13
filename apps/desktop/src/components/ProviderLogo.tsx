import { useEffect, useState } from 'react';
import anthropic from '@/assets/providers/anthropic.png';
import apinex from '@/assets/providers/apinex.jpg';
import cloudflareWorkersAi from '@/assets/providers/cloudflare-workers-ai.png';
import custom from '@/assets/providers/custom-openai-compatible.png';
import deepseek from '@/assets/providers/deepseek.png';
import google from '@/assets/providers/google.png';
import groq from '@/assets/providers/groq.ico';
import mistral from '@/assets/providers/mistral.png';
import nvidia from '@/assets/providers/nvidia-build.ico';
import ollama from '@/assets/providers/ollama.png';
import openai from '@/assets/providers/openai.png';
import openrouter from '@/assets/providers/openrouter.ico';
import radeon from '@/assets/providers/radeon-cloud.ico';

const logos: Record<string, string> = {
  anthropic,
  apinex,
  'cloudflare-workers-ai': cloudflareWorkersAi,
  'custom-openai-compatible': custom,
  deepseek,
  google,
  groq,
  mistral,
  'nvidia-build': nvidia,
  ollama,
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
