/**
 * Application shell: sidebar + header + main content area.
 */

import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import type { WsClient } from '@/lib/wsClient';

export interface ShellProps {
  readonly wsClient: WsClient | null;
  readonly children: ReactNode;
}

export function Shell({ wsClient, children }: ShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <Header wsClient={wsClient} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
