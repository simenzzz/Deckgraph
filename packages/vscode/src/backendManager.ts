/**
 * BackendManager — manages the Deckgraph backend process lifecycle.
 *
 * Spawns the backend as a child process, detects readiness via stdout,
 * surfaces stderr through a VS Code output channel, and retries on crash
 * with exponential backoff.
 */

import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

/** Default port for the Deckgraph backend. */
const DEFAULT_PORT = 3334;

/** Maximum number of restart attempts after a crash. */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff (1s, 2s, 4s). */
const BASE_DELAY_MS = 1_000;

/** Regex to detect backend readiness from stdout. */
const READY_REGEX = /Server listening on http:\/\/127\.0\.0\.1:(\d+)/;

/**
 * Manages the Deckgraph backend process lifecycle.
 *
 * Spawns `node <backendPath> --project <root> --port <port> --no-open`,
 * detects readiness from stdout, surfaces stderr in an output channel,
 * and restarts with exponential backoff on crash.
 */
export class BackendManager {
  private readonly outputChannel: vscode.OutputChannel;
  private readonly backendPath: string;
  private readonly projectRoot: string;
  private readonly port: number;

  private childProcess: ChildProcess | null = null;
  private retryCount = 0;
  private stopped = false;
  private readyCallbacks: Set<{ callback: () => void; disposable: vscode.Disposable }> = new Set();
  private ready = false;

  constructor(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Deckgraph');
    context.subscriptions.push(this.outputChannel);

    this.backendPath = context.asAbsolutePath(
      path.join('..', '..', 'backend', 'dist', 'index.js')
    );

    const config = vscode.workspace.getConfiguration('deckgraph');
    this.port = config.get<number>('port', DEFAULT_PORT);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('Deckgraph requires an open workspace folder.');
    }
    this.projectRoot = workspaceFolders[0].uri.fsPath;
  }

  /** Returns the WebSocket URL for the backend. */
  getWsUrl(): string {
    return `ws://127.0.0.1:${this.port}`;
  }

  /** Whether the backend has reported ready. */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Register a callback to be invoked when the backend reports ready.
   * If already ready, the callback fires immediately.
   */
  onReady(callback: () => void): vscode.Disposable {
    const entry = {
      callback,
      disposable: {
        dispose: () => { this.readyCallbacks.delete(entry); },
      },
    };
    this.readyCallbacks.add(entry);

    if (this.ready) {
      callback();
    }

    return entry.disposable;
  }

  /** Start the backend process. */
  start(): void {
    this.stopped = false;
    this.retryCount = 0;
    this.spawnProcess();
  }

  /** Stop the backend process and prevent restarts. */
  stop(): void {
    this.stopped = true;
    this.killProcess();
    this.ready = false;
    this.outputChannel.appendLine('[deckgraph] Backend stopped.');
  }

  /** Dispose all resources. */
  dispose(): void {
    this.stop();
    this.readyCallbacks.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private spawnProcess(): void {
    if (this.stopped) {
      return;
    }

    this.outputChannel.appendLine(
      `[deckgraph] Starting backend (attempt ${this.retryCount + 1}/${MAX_RETRIES + 1})...`
    );

    this.childProcess = spawn('node', [
      this.backendPath,
      '--project', this.projectRoot,
      '--port', String(this.port),
      '--no-open',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.outputChannel.append(text);

      const match = READY_REGEX.exec(text);
      if (match) {
        this.ready = true;
        this.retryCount = 0;
        this.outputChannel.appendLine('[deckgraph] Backend is ready.');
        this.notifyReady();
      }
    });

    this.childProcess.stderr?.on('data', (data: Buffer) => {
      this.outputChannel.append(data.toString());
    });

    this.childProcess.on('error', (err: Error) => {
      this.outputChannel.appendLine(`[deckgraph] Backend process error: ${err.message}`);
    });

    this.childProcess.on('exit', (code: number | null, signal: string | null) => {
      this.childProcess = null;
      this.ready = false;

      if (this.stopped) {
        return;
      }

      const reason = signal
        ? `killed by signal ${signal}`
        : `exited with code ${code ?? 'unknown'}`;
      this.outputChannel.appendLine(`[deckgraph] Backend ${reason}.`);

      if (this.retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, this.retryCount);
        this.retryCount++;
        this.outputChannel.appendLine(
          `[deckgraph] Restarting in ${delay}ms (retry ${this.retryCount}/${MAX_RETRIES})...`
        );
        setTimeout(() => { this.spawnProcess(); }, delay);
      } else {
        this.outputChannel.appendLine(
          `[deckgraph] Max retries (${MAX_RETRIES}) reached. Backend will not restart.`
        );
      }
    });
  }

  private killProcess(): void {
    if (this.childProcess && !this.childProcess.killed) {
      this.childProcess.kill();
      this.childProcess = null;
    }
  }

  private notifyReady(): void {
    for (const { callback } of this.readyCallbacks) {
      try {
        callback();
      } catch (error) {
        this.outputChannel.appendLine(
          `[deckgraph] Ready callback error: ${error instanceof Error ? error.message : 'unknown'}`
        );
      }
    }
  }
}
