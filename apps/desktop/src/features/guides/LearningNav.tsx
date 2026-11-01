import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Layers, ScanEye, Workflow } from 'lucide-react';

export function LearningNav() {
  const { i18n } = useTranslation();
  const fa = i18n.resolvedLanguage?.startsWith('fa');
  const { pathname } = useLocation();
  const items = [
    { to: '/learning', title: fa ? 'مطالب مشترک' : 'Common workflow', icon: BookOpen },
    { to: '/guides', title: fa ? 'آموزش برنامه‌ها' : 'App guides', icon: BookOpen },
    { to: '/guides/extensions', title: fa ? 'اسکیل‌ها بر اساس موضوع' : 'Skills by topic', icon: Layers },
    { to: '/learning/code-review', title: fa ? 'بازبینی کد با Claude' : 'Code review with Claude', icon: ScanEye },
    { to: '/learning/long-running', title: fa ? 'کارهای طولانی با ایجنت' : 'Long-running agent tasks', icon: Workflow },
  ];
  return <nav className="vh-learning-nav" aria-label={fa ? 'بخش‌های یادگیری' : 'Learning sections'}>{items.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/guides' || item.to === '/learning'} className={({ isActive }) => (item.to === '/guides' ? pathname === '/guides' || (pathname.startsWith('/guides/') && pathname !== '/guides/extensions') : isActive) ? 'is-active' : ''}><item.icon size={17} aria-hidden="true" />{item.title}</NavLink>)}</nav>;
}
