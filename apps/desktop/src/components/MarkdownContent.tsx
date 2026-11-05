import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import screenshots from '../lib/tutorial-screenshots.json';

function TutorialImage({ asset, alt, onError }: { asset: string; alt: string; onError: (error: unknown) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  const { i18n } = useTranslation();
  const fa = i18n.resolvedLanguage?.startsWith('fa');
  const metadata = screenshots.find(item => item.file === asset);
  if (!metadata) return null;
  const src = `${import.meta.env.BASE_URL}tutorials/${asset}`;
  const label = fa ? `بزرگ‌نمایی: ${alt}` : `Enlarge: ${alt}`;
  return <figure className="my-6 min-w-0 space-y-2">
    {failed ? <p role="status" className="text-sm text-muted">{fa ? 'تصویر در دسترس نیست؛ توضیح و منبع را در زیر ببینید.' : 'Image unavailable; see the description and source below.'}</p> :
      <button type="button" className="block w-full cursor-zoom-in rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={label} onClick={() => dialog.current?.showModal()}>
        <img src={src} alt={alt} width={metadata.width} height={metadata.height} loading="lazy" decoding="async" onError={() => setFailed(true)} className="mx-auto h-auto max-w-full rounded-lg border border-border" />
      </button>}
    <figcaption className="space-y-1 text-sm leading-6 text-muted">
      <span className="block">{alt}</span>
      <span className="block">{metadata.kind === 'local-screenshot' ? (fa ? 'اسکرین‌شات محیط واقعی؛ ثبت: ' : 'Real app screenshot; captured: ') : metadata.kind === 'maintainer-screenshot' ? (fa ? 'تصویر سازندهٔ افزونه؛ دریافت: ' : 'Plugin maintainer screenshot; retrieved: ') : (fa ? 'تصویر رسمی؛ دریافت: ' : 'Official image; retrieved: ')}<bdi>{metadata.retrievedAt}</bdi>{' · '}
        <button type="button" className="text-primary underline underline-offset-4" onClick={() => void openUrl(metadata.sourcePage).catch(onError)}>{metadata.kind === 'local-screenshot' ? (fa ? 'راهنمای رسمی برنامه' : 'Official app guide') : (fa ? 'منبع تصویر' : 'Image source')}</button>
      </span>
      {metadata.sourceVersion && <span className="block">{metadata.kind === 'local-screenshot' ? (fa ? 'نسخهٔ برنامهٔ ثبت‌شده: ' : 'Captured app version: ') : (fa ? 'نسخهٔ نمونهٔ منبع: ' : 'Source example version: ')}<bdi>{metadata.sourceVersion}</bdi></span>}
    </figcaption>
    <dialog ref={dialog} aria-label={alt} className="max-h-[95vh] max-w-[95vw] overflow-auto rounded-xl border border-border bg-surface p-4 text-text backdrop:bg-black/70">
      <form method="dialog" className="sticky top-0 flex justify-end"><button autoFocus className="min-h-11 min-w-11 rounded-lg bg-surface px-3 text-sm">{fa ? 'بستن' : 'Close'} ×</button></form>
      <img src={src} alt={alt} width={metadata.width} height={metadata.height} className="h-auto max-w-none" />
    </dialog>
  </figure>;
}

export function MarkdownContent({ source, onError }: { source: string; onError: (error: unknown) => void }) {
  return <div className="guide vh-article-body break-words text-base leading-8">
    <Markdown skipHtml components={{
      p: ({ children, node }) => node?.children.some(child => child.type === 'element' && child.tagName === 'img') ? <div>{children}</div> : <p>{children}</p>,
      h2: ({ children }) => <h2 className="mb-3 mt-8 text-lg font-bold">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-2 mt-6 text-base font-semibold">{children}</h3>,
      code: ({ children, className }) => <code dir="ltr" className={className} style={{ unicodeBidi: 'isolate' }}>{children}</code>,
      pre: ({ children }) => <pre dir="ltr" className="my-4 max-w-full overflow-x-auto rounded-lg border border-border bg-surface-alt p-3 text-left">{children}</pre>,
      em: ({ children }) => <em className="text-muted">{children}</em>,
      a: ({ href, children }) => href?.startsWith('/') && !href.startsWith('//')
        ? <Link className="text-primary underline underline-offset-4" to={href}>{children}</Link>
        : <button type="button" className="inline text-primary underline underline-offset-4" onClick={() => { if (href && /^https:\/\//i.test(href)) void openUrl(href).catch(onError); }}>{children}</button>,
      img: ({ src, alt }) => {
        const asset = src?.match(/(?:^|\/)tutorials\/([a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:png|webp))$/i)?.[1];
        return asset ? <TutorialImage asset={asset} alt={alt ?? ''} onError={onError} /> : null;
      },
    }}>{source.replace(/^# [^\n]+\n+/, '')}</Markdown>
  </div>;
}
