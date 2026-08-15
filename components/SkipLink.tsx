'use client';

import { useRef, useEffect } from 'react';

export function SkipLink() {
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const handleFocus = () => {
      skipLinkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const link = skipLinkRef.current;
    if (link) {
      link.addEventListener('focus', handleFocus);
      return () => link.removeEventListener('focus', handleFocus);
    }
  }, []);

  return (
    <a
      ref={skipLinkRef}
      href="#main-content"
      className="skip-link"
      aria-label="Skip to main content"
    >
      Skip to main content
    </a>
  );
}




