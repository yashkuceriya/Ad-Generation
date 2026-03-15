import { useEffect } from 'react';

export default function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Nerdy Ad Engine` : 'Nerdy Ad Engine';
  }, [title]);
}
