'use client';

import type { ReactNode } from 'react';
import { TOKEN } from '@aircon/core';

export function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>
      {children}
    </div>
  );
}
