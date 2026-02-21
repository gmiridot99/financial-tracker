'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

export default function ResponsiveToaster() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <Toaster
      position={isMobile ? 'top-center' : 'top-right'}
      toastOptions={{
        style: {
          background: '#12151A',
          color: '#F0F2F5',
          border: '1px solid #1A1E26',
        },
        success: {
          iconTheme: {
            primary: '#34D399',
            secondary: '#F0F2F5',
          },
        },
        error: {
          iconTheme: {
            primary: '#F87171',
            secondary: '#F0F2F5',
          },
        },
      }}
    />
  );
}
