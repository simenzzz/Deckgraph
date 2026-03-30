/**
 * Stub VS Code API for unit tests.
 *
 * Provides the minimal surface area that the Deckgraph extension code
 * depends on. Tests can spy on these stubs to verify interactions.
 */

const disposable = { dispose: () => {} };

export const window = {
  createOutputChannel: () => ({
    append: () => {},
    appendLine: () => {},
    dispose: () => {},
  }),
  createTreeView: () => disposable,
  showInformationMessage: () => {},
  showWarningMessage: () => {},
  showErrorMessage: () => {},
};

export const workspace = {
  workspaceFolders: [
    { uri: { fsPath: '/tmp/test-workspace' } },
  ],
  getConfiguration: () => ({
    get: (_key: string, defaultValue: unknown) => defaultValue,
  }),
};

export const commands = {
  registerCommand: () => disposable,
};

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  get event(): (listener: (e: T) => void) => { dispose(): void } {
    return (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
  }

  fire(_data: T): void {}
  dispose(): void {}
}

export class TreeItem {
  label?: string;
  collapsibleState?: number;
  constructor(label?: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class Uri {
  static file(path: string): Uri {
    return new Uri(path);
  }
  constructor(public readonly fsPath: string) {}
}

export interface Disposable {
  dispose(): void;
}
