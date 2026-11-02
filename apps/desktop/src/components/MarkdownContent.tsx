import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';

export function MarkdownContent({ source, onError }: { source: string; onError: (error: unknown) => void }) {
  return <div className="guide vh-article-body break-words text-base leading-8">
    <Markdown skipHtml components={{
      h2: ({ children }) => <h2 className="mb-3 mt-8 text-lg font-bold">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-2 mt-6 text-base font-semibold">{children}</h3>,
      pre: ({ children }) => <pre dir="ltr" className="my-4 max-w-full overflow-x-auto rounded-lg border border-border bg-surface-alt p-3 text-left">{children}</pre>,
      em: ({ children }) => <em className="text-muted">{children}</em>,
      a: ({ href, children }) => href?.startsWith('/') && !href.startsWith('//')
        ? <Link className="text-primary underline underline-offset-4" to={href}>{children}</Link>
        : <button type="button" className="inline text-primary underline underline-offset-4" onClick={() => { if (href && /^https:\/\//i.test(href)) void openUrl(href).catch(onError); }}>{children}</button>,
      img: ({ src, alt }) => {
        const asset = src?.match(/(?:^|\/)tutorials\/([a-z0-9-]+\.(?:svg|png|webp))$/i)?.[1];
        return asset ? <img src={`/tutorials/${asset}`} alt={alt ?? ''} loading="lazy" /> : null;
      },
    }}>{source.replace(/^# [^\n]+\n+/, '')}</Markdown>
  </div>;
}
