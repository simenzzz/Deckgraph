/**
 * Root application component.
 *
 * Creates the WS client on mount, wires callbacks to the message dispatcher,
 * and renders the Shell with view routing.
 */

import { useEffect, useRef, useState } from 'react';
import { Shell } from '@/components/layout';
import { ProjectOverview } from '@/components/overview';
import { ModuleExplorer } from '@/components/explorer';
import { useConnectionStore, useViewStore } from '@/stores';
import { createWsClient, getWsUrl, type WsClient } from '@/lib/wsClient';
import { dispatchServerMessage } from '@/lib/messageDispatcher';
import { useViewQuery } from '@/hooks';

export function App() {
  const [wsClient, setWsClient] = useState<WsClient | null>(null);
  const clientRef = useRef<WsClient | null>(null);
  const currentView = useViewStore((s) => s.currentView);

  useEffect(() => {
    const client = createWsClient({
      url: getWsUrl(),
      onMessage: dispatchServerMessage,
      onStatusChange: (status) => {
        useConnectionStore.getState().setStatus(status);
      },
    });

    clientRef.current = client;
    setWsClient(client);
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  // Send view_query when filters change
  useViewQuery(wsClient);

  return (
    <Shell wsClient={wsClient}>
      {currentView === 'overview' && <ProjectOverview wsClient={wsClient} />}
      {currentView === 'explorer' && <ModuleExplorer />}
    </Shell>
  );
}
