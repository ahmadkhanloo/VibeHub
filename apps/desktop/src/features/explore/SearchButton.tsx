import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button, ErrorNotice, Input, Modal, Spinner } from '@/components/ui';
import { SearchScope } from './SearchScope';

type Results = typeof import('./Search').SearchResults;
const loadSearch = () => import('./Search');
const prefetchSearch = () => { void loadSearch().catch(() => {}); };

export function SearchButton() {
  const { t } = useTranslation('ux');
  const navigate = useNavigate();
  const label = t('searchLabel');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'learning'>('all');
  const [Results, setResults] = useState<Results>();
  const [loadError, setLoadError] = useState<unknown>();

  const close = () => {
    setOpen(false);
    setQuery('');
    setScope('all');
    setLoadError(undefined);
  };

  useEffect(() => {
    if (!open || Results) return;
    let active = true;
    void loadSearch().then(
      module => { if (active) setResults(() => module.SearchResults); },
      error => { if (active) setLoadError(error); },
    );
    return () => { active = false; };
  }, [open, Results]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const searchKey = event.key.toLowerCase() === 'k' || event.code === 'KeyK';
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && searchKey && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  return <>
    <Button variant="ghost" className="vh-search-trigger" aria-label={label} title={label}
      aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Control+K Meta+K"
      onPointerEnter={prefetchSearch} onFocus={prefetchSearch} onClick={() => setOpen(true)}>
      <Search size={17} aria-hidden="true" />
    </Button>
    {open && <Modal open title={label} onClose={close}>
      <form className="vh-search-form" onSubmit={event => {
        event.preventDefault();
        const value = query.trim();
        if (!value) return;
        const params = new URLSearchParams({ q: value });
        if (scope === 'learning') params.set('scope', scope);
        close();
        navigate('/search?' + params);
      }}>
        <Input data-autofocus id="global-search" type="search" aria-label={label} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          close();
        }} />
        <SearchScope value={scope} onChange={setScope} />
        <Button type="submit" size="sm" disabled={!query.trim()}>{t('viewSearchResults')}</Button>
      </form>
      {loadError != null ? <ErrorNotice error={loadError} />
        : Results ? <Results query={query} learning={scope === 'learning'} onSelect={close} />
          : query.trim() ? <Spinner /> : <p className="text-sm text-muted">{t('searchHint')}</p>}
    </Modal>}
  </>;
}
