/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import chalk from 'chalk';
import figures from 'figures';
import logUpdate from 'log-update';
import Module from './Module';
import {
  STATUS_PENDING,
  STATUS_RUNNING,
  STATUS_SKIPPED,
  STATUS_PASSED,
  STATUS_FAILED,
} from './constants';

import type Task from './Task';
import type { ReportLoader } from './types';

export const REFRESH_RATE: number = 100;
export const CURSOR: string = '\x1B[?25h'; // eslint-disable-line unicorn/no-hex-escape

export default class Reporter<To: Object = {}> extends Module<To> {
  instance: number = 0;

  loader: ?ReportLoader = null;

  /**
   * Create an indentation based on the defined length.
   */
  indent(length: number): string {
    return '  '.repeat(length);
  }

  /**
   * Render the output by looping over all tasks and messages.
   */
  render(code?: number = 0): string {
    if (!this.loader) {
      return CURSOR;
    }

    const {
      debug = false,
      debugs = [],
      errors = [],
      footer = '',
      header = '',
      logs = [],
      silent = false,
      tasks = [],
    } = this.loader();
    const output = [];
    const verbose = !silent;

    if (header && verbose) {
      output.push(header);
    }

    // Tasks first
    if (tasks.length > 0 && verbose) {
      tasks.forEach((task) => {
        output.push(...this.renderTask(task, 0));
      });
    }

    // Debugs second
    if (debugs.length > 0 && debug) {
      output.push('');

      debugs.forEach((log) => {
        output.push(this.renderMessage(log));
      });
    }

    // Messages last
    // eslint-disable-next-line no-nested-ternary
    const messages = (code === 0) ? (verbose ? logs : []) : errors;

    if (messages.length > 0) {
      output.push('');

      messages.forEach((log) => {
        output.push(this.renderMessage(log));
      });
    }

    if (footer && verbose) {
      output.push(footer);
    }

    // Show terminal cursor
    output.push(CURSOR);

    return output.join('\n').trim();
  }

  /**
   * Render a debug, log, or error message.
   */
  renderMessage(message: string): string {
    return message;
  }

  /**
   * Render a single task including its title and status.
   * If sub-tasks or sub-routines exist, render them recursively.
   */
  renderTask(task: Task<Object, Object>, level?: number = 0, suffix?: string = ''): string[] {
    const output = [];

    // Generate the message row
    let message = `${this.indent(level)}${this.renderStatus(task)} ${task.title}`;

    if (task.isSkipped()) {
      message += ` ${chalk.yellow('[skipped]')}`;

    } else if (task.hasFailed()) {
      message += ` ${chalk.red('[failed]')}`;

    } else if (suffix) {
      message += ` ${suffix}`;
    }

    output.push(message);

    // Show only one sub-task at a time
    if (task.subtasks.length > 0) {
      let pendingTask;
      let runningTask;
      let failedTask;
      let passed = 0;

      task.subtasks.forEach((subTask) => {
        if (subTask.isPending() && !pendingTask) {
          pendingTask = subTask;

        } else if (subTask.isRunning() && !runningTask) {
          runningTask = subTask;

        } else if (subTask.hasFailed() && !failedTask) {
          failedTask = subTask;

        } else if (subTask.hasPassed()) {
          passed += 1;
        }
      });

      const activeTask = failedTask || runningTask || pendingTask;
      const taskSuffix = chalk.gray(`[${passed}/${task.subtasks.length}]`);

      // Only show if the parent is running or a task failed
      if (activeTask && (task.isRunning() || failedTask)) {
        output.push(...this.renderTask(activeTask, level + 1, taskSuffix));
      }
    }

    // Show the current status output
    if (task.statusText) {
      output.push(`${this.indent(level + 1)}${chalk.gray(task.statusText)}`);
    }

    // Show all sub-routines
    if (task.subroutines.length > 0) {
      task.subroutines.forEach((routine) => {
        output.push(...this.renderTask(routine, level + 1));
      });
    }

    return output;
  }

  /**
   * Render a status symbol for a task.
   */
  renderStatus(task: Task<Object, Object>): string {
    switch (task.status) {
      case STATUS_PENDING:
        return chalk.gray(figures.bullet);
      case STATUS_RUNNING:
        return chalk.gray(task.spinner());
      case STATUS_SKIPPED:
        return chalk.yellow(figures.circleDotted);
      case STATUS_PASSED:
        return chalk.green(figures.tick);
      case STATUS_FAILED:
        return chalk.red(figures.cross);
      default:
        return '';
    }
  }

  /**
   * Start the output process once setting the task loader.
   */
  start(loader: ReportLoader) {
    if (this.instance) {
      return;
    } else if (!loader || typeof loader !== 'function') {
      throw new TypeError('A loader is required to render console output.');
    }

    this.loader = loader;

    /* istanbul ignore next */
    this.instance = setInterval(() => { this.update(); }, REFRESH_RATE);
  }

  /**
   * Stop and clear the output process.
   */
  stop() {
    clearInterval(this.instance);

    logUpdate.clear();
  }

  /**
   * Update and flush the output.
   */
  update() {
    const output = this.render();

    if (output) {
      logUpdate(output);
    }
  }
}
