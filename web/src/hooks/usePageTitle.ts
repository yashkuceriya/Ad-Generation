import { useEffect } from 'react';

export default function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Ad Engine` : 'Ad Engine';
  }, [title]);
}
