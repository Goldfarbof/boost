/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import chalk from 'chalk';
import figures from 'figures';
import logUpdate from 'log-update';
import TaskResult from './TaskResult';
import { PENDING, RUNNING, SKIPPED, PASSED, FAILED } from './constants';

import type { Chalk } from 'chalk'; // eslint-disable-line
import type { LogUpdate } from 'log-update'; // eslint-disable-line
import type { ResultsLoader } from './types';

export default class Renderer {
  chalk: Chalk;
  instance: number = 0;
  load: ResultsLoader;
  log: LogUpdate;

  constructor(loader: ResultsLoader) {
    this.chalk = chalk;
    this.load = loader;
    this.log = logUpdate;
  }

  /**
   * Create an indentation based on the defined length.
   */
  indent(length: number): string {
    return '    '.repeat(length);
  }

  /**
   * Render the output by looping over all results in the tree.
   */
  render() {
    const output = [];
    const results = this.load();

    results.forEach((result: TaskResult) => {
      output.push(...this.renderResult(result, 0));
    });

    return output.join('\n');
  }

  /**
   * Render a single result including it's title and status.
   * If sub-tasks or routines exist, render them recursively.
   */
  renderResult(result: TaskResult, level: number = 0, suffix: string = ''): string[] {
    const output = [];

    // Generate the message row
    let message = `${this.indent(level)}${this.renderStatus(result)} ${result.title}`;

    if (result.isSkipped()) {
      message += ` ${chalk.yellow('[skipped]')}`;

    } else if (result.hasFailed()) {
      message += ` ${chalk.red('[failed]')}`;

    } else if (suffix) {
      message += ` ${suffix}`;
    }

    output.push(message);

    // Show only one task at a time
    let pendingTask;
    let runningTask;
    let failedTask;
    let passed = 0;

    result.tasks.forEach((task: TaskResult) => {
      if (task.isPending() && !pendingTask) {
        pendingTask = task;

      } else if (task.isRunning() && !runningTask) {
        runningTask = task;

      } else if (task.hasFailed() && !failedTask) {
        failedTask = task;

      } else if (task.hasPassed()) {
        passed += 1;
      }
    });

    const activeTask = failedTask || runningTask || pendingTask;
    const taskSuffix = chalk.gray(`[${passed}/${result.tasks.length}]`);

    // Only show if the parent is running or a task failed
    if (activeTask && (result.isRunning() || failedTask)) {
      output.push(...this.renderResult(activeTask, level + 1, taskSuffix));
    }

    // Show all subroutines
    result.routines.forEach((routine: TaskResult) => {
      output.push(...this.renderResult(routine, level + 1));
    });

    return output;
  }

  /**
   * Render a status symbol for a result.
   */
  renderStatus(result: TaskResult): string {
    switch (result.status) {
      case PENDING:
        return chalk.gray(figures.bullet);
      case RUNNING:
        return chalk.gray(result.spinner());
      case SKIPPED:
        return chalk.yellow(figures.circleDotted);
      case PASSED:
        return chalk.green(figures.tick);
      case FAILED:
        return chalk.red(figures.cross);
      default:
        return '';
    }
  }

  /**
   * Clear the current output.
   */
  reset() {
    this.log.clear();
  }

  /**
   * Start the rendering process.
   */
  start() {
    if (!this.instance) {
      this.instance = setInterval(() => this.update(), 100);
    }
  }

  /**
   * Stop rendering and finalize the output.
   */
  stop() {
    this.update();

    if (this.instance) {
      clearInterval(this.instance);
      this.instance = 0;
    }

    this.log.done();
  }

  /**
   * Force a render and update the current output.
   */
  update() {
    if (this.instance) {
      this.log(this.render());
    } else {
      this.start();
    }
  }
}
