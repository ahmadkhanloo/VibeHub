import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui';

export function SearchScope({ value, onChange }: {
  value: 'all' | 'learning';
  onChange: (scope: 'all' | 'learning') => void;
}) {
  const { t } = useTranslation(['ux', 'nav']);
  return <Select aria-label={t('searchScope')} value={value} onChange={onChange} options={[
    { value: 'all', label: t('searchScopeAll') },
    { value: 'learning', label: t('nav:learning') },
  ]} />;
}
