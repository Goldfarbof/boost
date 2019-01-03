/**
 * @copyright   2017-2019, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 */

/* eslint-disable no-console */

import exit from 'exit';
import cliTruncate from 'cli-truncate';
import cliSize from 'term-size';
import ansiEscapes from 'ansi-escapes';
import stripAnsi from 'strip-ansi';
import wrapAnsi from 'wrap-ansi';
import Emitter from './Emitter';
import Tool from './Tool';
import { Debugger } from './types';

const boundConsole = {
  error: console.error.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
};

// TODO
// - render Output classes
// - footer

// console.* - captured into `bufferedConsole`
// out - write to stdout
// err - write to stderr
// render - schedule a render of `Output`s
export default class Console extends Emitter {
  bufferedConsole: (() => void)[] = [];

  debug: Debugger;

  errorLogs: string[] = [];

  exiting: boolean = false;

  logs: string[] = [];

  renderTimer: NodeJS.Timer | null = null;

  restoreCursorOnExit: boolean = false;

  tool: Tool<any, any>;

  constructor(tool: Tool<any, any>) {
    super();

    this.debug = tool.createDebugger('console');
    this.tool = tool;

    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'test') {
      process
        .on('SIGINT', this.handleSignal)
        .on('SIGTERM', this.handleSignal)
        .on('uncaughtException', this.handleFailure)
        .on('unhandledRejection', this.handleFailure);
    }
  }

  /**
   * Display a footer after all output.
   */
  displayFooter() {
    const { footer } = this.tool.options;

    if (footer) {
      this.out(footer, 1);
    }
  }

  /**
   * Display a header before all output.
   */
  displayHeader() {
    const { header } = this.tool.options;

    if (header) {
      this.out(header, 1);
    }
  }

  /**
   * Display logs in the final output.
   */
  displayLogs(logs: string[]) {
    if (logs.length > 0) {
      this.out(`\n${logs.join('\n')}\n`);
    }
  }

  /**
   * Write a message to `stderr` with optional trailing newline(s).
   */
  err(message: string, nl: number = 0): this {
    if (this.tool.config.silent) {
      return this;
    }

    process.stderr.write(message + '\n'.repeat(nl));

    return this;
  }

  /**
   * Force exit the application.
   */
  exit(message: string | Error | null, code: number, force: boolean = false) {
    // Another flow has already triggered the exit
    if (this.exiting) {
      return;
    }

    this.exiting = true;

    let error = null;

    if (message !== null) {
      error = message instanceof Error ? message : new Error(message);
    }

    if (error) {
      this.debug('Exiting console with an error');

      // Mark logs as errors
      if (force) {
        this.errorLogs.push(...this.logs);
        this.logs = [];
      }
    } else {
      this.debug('Exiting console rendering process');
    }

    this.emit('stop', [error, code]);

    // Render final output
    this.handleFinalRender(error);

    // Unwrap our native console
    this.unwrapConsole();

    // Exit after buffers have flushed
    if (force) {
      exit(code);
    } else {
      process.exitCode = code;
    }
  }

  /**
   * Flush buffered native console output.
   */
  flushBufferedConsole(): this {
    this.bufferedConsole.forEach(buffer => {
      buffer();
    });

    return this;
  }

  /**
   * Handle uncaught exceptions and unhandled rejections that bubble up.
   */
  handleFailure = (error: Error) => {
    this.start();
    this.debug('Uncaught exception or unresolved promise handled');
    this.exit(error, 1, true);
  };

  /**
   * Handle the final render before exiting.
   */
  handleFinalRender = (error: Error | null = null) => {
    this.debug('Rendering final console output');
    this.resetRenderTimer();
    this.flushBufferedConsole();

    if (error) {
      this.emit('render');
      this.displayLogs(this.errorLogs);
      this.emit('error', [error]);
    } else {
      this.displayHeader();
      this.emit('render');
      this.displayLogs(this.logs);
      this.displayFooter();
    }

    this.flushBufferedConsole();

    // Remover listeners so that we avoid unwanted re-renders
    this.clearListeners('render');
    this.clearListeners('error');
  };

  /**
   * Handle the entire rendering and flushing process.
   */
  handleRender = (error: Error | null = null) => {
    this.resetRenderTimer();
    this.flushBufferedConsole();
    this.emit('render');

    if (error) {
      this.emit('error', [error]);
    }
  };

  /**
   * Handle SIGINT and SIGTERM interruptions.
   */
  handleSignal = () => {
    this.start();
    this.debug('SIGINT or SIGTERM handled');
    this.exit('Process has been terminated.', 1, true);
  };

  /**
   * Hide the console cursor.
   */
  hideCursor(): this {
    this.out(ansiEscapes.cursorHide);

    if (!this.restoreCursorOnExit && !this.tool.config.silent) {
      this.restoreCursorOnExit = true;

      /* istanbul ignore next */
      process.on('exit', () => {
        process.stdout.write(ansiEscapes.cursorShow);
      });
    }

    return this;
  }

  /**
   * Store the log message.
   */
  log(message: string): this {
    this.logs.push(message);

    return this;
  }

  /**
   * Store the live message by passing to the buffered console.
   */
  logLive(message: string): this {
    console.log(message);

    return this;
  }

  /**
   * Store the error message.
   */
  logError(message: string): this {
    this.errorLogs.push(message);

    return this;
  }

  /**
   * Write a message to `stdout` with optional trailing newline(s).
   */
  out(message: string, nl: number = 0): this {
    if (this.tool.config.silent) {
      return this;
    }

    process.stdout.write(message + '\n'.repeat(nl));

    return this;
  }

  /**
   * Debounce the render as to avoid tearing.
   */
  render(): this {
    const refreshRate = 100;

    if (!this.renderTimer) {
      this.renderTimer = setTimeout(() => {
        this.handleRender();
      }, refreshRate);
    }

    return this;
  }

  /**
   * Reset the cursor back to the bottom of the console.
   */
  resetCursor(): this {
    this.out(ansiEscapes.cursorTo(0, this.size().rows));

    return this;
  }

  /**
   * Reset the render only timer.
   */
  resetRenderTimer() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  /**
   * Show the console cursor.
   */
  showCursor(): this {
    this.restoreCursorOnExit = false;
    this.out(ansiEscapes.cursorShow);

    return this;
  }

  /**
   * Return size information about the terminal window.
   */
  size(): { columns: number; rows: number } {
    return cliSize();
  }

  /**
   * Start the console by wrapping streams and buffering output.
   */
  start(args: any[] = []): this {
    this.debug('Starting console rendering process');

    this.wrapConsole();
    this.displayHeader();
    this.emit('start', args);

    return this;
  }

  /**
   * Strip ANSI characters from a string.
   */
  strip(message: string): string {
    return stripAnsi(message);
  }

  /**
   * Truncate a string that may contain ANSI characters to a specific column width.
   */
  truncate(
    message: string,
    columns?: number,
    options?: { position?: 'start' | 'middle' | 'end' },
  ): string {
    return cliTruncate(message, columns || this.size().columns, options);
  }

  /**
   * Unwrap the native console and reset it back to normal.
   */
  unwrapConsole() {
    this.debug('Unwrapping native console');

    console.log = boundConsole.log;
    console.info = boundConsole.info;
    console.error = boundConsole.error;
    console.warn = boundConsole.warn;
  }

  /**
   * Wrap a string that may contain ANSI characters to a specific column width.
   */
  wrap(
    message: string,
    columns?: number,
    options?: { hard?: boolean; trim?: boolean; wordWrap?: boolean },
  ): string {
    return wrapAnsi(message, columns || this.size().columns, {
      hard: true,
      trim: false,
      ...options,
    });
  }

  /**
   * Wrap the native console and buffer the output as to not collide with our reporter.
   */
  wrapConsole() {
    this.debug('Wrapping native console');

    ['log', 'info', 'error', 'warn'].forEach(name => {
      const method = name as keyof typeof boundConsole;
      let buffer = '';

      this.bufferedConsole.push(() => {
        if (process.stdout.isTTY && buffer) {
          boundConsole[method](buffer);
        }

        buffer = '';
      });

      console[method] = (...messages: string[]) => {
        buffer += messages.join('\n');
      };
    });
  }
}
