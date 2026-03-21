/**
 * Hook that subscribes to filterStore, composes a ViewQuery,
 * and sends view_query via the WS client.
 *
 * Search is debounced (300ms). Toggle changes are instant.
 */

import { useEffect } from 'react';
import type { ViewQuery } from '@deckgraph/shared';
import { useFilterStore, useProjectStore, useViewStore } from '@/stores';
import { useDebounce } from './useDebounce';
import type { WsClient } from '@/lib/wsClient';
import { createRequestId } from '@/lib/wsClient';

const SEARCH_DEBOUNCE_MS = 300;

export function useViewQuery(wsClient: WsClient | null): void {
  const ecosystems = useFilterStore((s) => s.ecosystems);
  const scopes = useFilterStore((s) => s.scopes);
  const search = useFilterStore((s) => s.search);
  const showCrossEdges = useFilterStore((s) => s.showCrossEdges);
  const concern = useFilterStore((s) => s.concern);
  const project = useProjectStore((s) => s.project);
  const setLoading = useViewStore((s) => s.setLoading);

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (!wsClient || !project) {
      return;
    }

    // H2: Build query with conditional spreads — no unsafe casts
    const query: ViewQuery = {
      ...(ecosystems.length > 0 ? { ecosystems } : {}),
      ...(scopes.length > 0 ? { scopes } : {}),
      ...(debouncedSearch.length > 0 ? { search: debouncedSearch } : {}),
      ...(showCrossEdges ? { showCrossEdges: true } : {}),
      ...(concern ? { concern } : {}),
    };

    // H4: Only set loading if the message was actually sent
    const sent = wsClient.send({
      type: 'view_query',
      requestId: createRequestId(),
      query,
    });

    if (sent) {
      setLoading(true);
    }
  }, [wsClient, project, ecosystems, scopes, debouncedSearch, showCrossEdges, concern, setLoading]);
}
