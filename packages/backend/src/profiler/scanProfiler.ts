/**
 * Scan profiler for measuring phase durations.
 *
 * Uses performance.now() for high-resolution timing.
 * Timings are logged via pino at scan completion.
 */

export interface PhaseTimings {
  readonly discoveryMs: number;
  readonly manifestParsingMs: number;
  readonly graphBuildMs: number;
  readonly crossLangMs: number;
  readonly totalMs: number;
}

export interface ScanProfiler {
  /** Start timing a named phase. */
  startPhase(name: string): void;
  /** End timing a named phase. */
  endPhase(name: string): void;
  /** Get cumulative timings for all phases. */
  getTimings(): PhaseTimings;
}

/**
 * Create a new scan profiler.
 */
export function createScanProfiler(): ScanProfiler {
  const starts = new Map<string, number>();
  const durations = new Map<string, number>();

  return {
    startPhase(name: string): void {
      starts.set(name, performance.now());
    },

    endPhase(name: string): void {
      const start = starts.get(name);
      if (start !== undefined) {
        const existing = durations.get(name) ?? 0;
        durations.set(name, existing + (performance.now() - start));
        starts.delete(name);
      }
    },

    getTimings(): PhaseTimings {
      const discoveryMs = durations.get('discovery') ?? 0;
      const manifestParsingMs = durations.get('manifestParsing') ?? 0;
      const graphBuildMs = durations.get('graphBuild') ?? 0;
      const crossLangMs = durations.get('crossLang') ?? 0;

      return {
        discoveryMs,
        manifestParsingMs,
        graphBuildMs,
        crossLangMs,
        totalMs: discoveryMs + manifestParsingMs + graphBuildMs + crossLangMs,
      };
    },
  };
}
