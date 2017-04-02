/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import merge from 'lodash/merge';
import isObject from 'lodash/isObject';

import type { RoutineConfig, Result, ResultPromise, ResultAccumulator, Task } from './types';

export default class Routine {
  config: RoutineConfig = {};
  globalConfig: RoutineConfig = {};
  name: string = '';
  subroutines: Routine[] = [];

  constructor(name: string, defaultConfig: RoutineConfig = {}) {
    if (!name || typeof name !== 'string') {
      throw new TypeError('Routine name must be a valid string.');
    }

    this.config = { ...defaultConfig };
    this.name = name;
  }

  /**
   * Configure the routine after it has been instantiated.
   */
  configure(parentConfig: RoutineConfig, globalConfig: RoutineConfig): this {
    this.globalConfig = globalConfig;

    // Inherit config from parent
    const config = parentConfig[this.name];

    if (isObject(config)) {
      // $FlowIssue Flow cannot introspect from isObject
      merge(this.config, config);
    }

    // Initialize setup
    this.setup();

    return this;
  }

  /**
   * Execute the current routine and return a new value.
   * This method *must* be overridden in a subclass.
   */
  execute(value: Result<*>): ResultPromise<*> {
    return this.wrapPromise(value);
  }

  /**
   * Execute a subroutine wih the provided value.
   */
  executeSubroutine = (value: Result<*>, routine: Routine): ResultPromise<*> => (
    this.wrapPromise(routine.execute(value))
  );

  /**
   * Execute a task, a method in the current routine, or a function,
   * with the provided value.
   */
  executeTask = (value: Result<*>, task: Task<*>): ResultPromise<*> => (
    this.wrapPromise(task.call(this, value))
  );

  /**
   * Execute subroutines in parralel with a value being passed to each subroutine.
   * A combination promise will be returned as the result.
   */
  parallelizeSubroutines(value: Result<*>): ResultPromise<*> {
    return Promise.all(this.subroutines.map(routine => this.executeSubroutine(value, routine)));
  }

  /**
   * Execute tasks in parralel with a value being passed to each task.
   * A combination promise will be returned as the result.
   */
  parallelizeTasks(value: Result<*>, tasks: Task<*>[]): ResultPromise<*> {
    return Promise.all(tasks.map(task => this.executeTask(value, task)));
  }

  /**
   * Add a new subroutine within this routine.
   */
  pipe(...routines: Routine[]): this {
    routines.forEach((routine: Routine) => {
      if (routine instanceof Routine) {
        this.subroutines.push(routine.configure(this.config, this.globalConfig));
      } else {
        throw new TypeError('Routine must be an instance of `Routine`.');
      }
    });

    return this;
  }

  /**
   * Execute processes in sequential order with the output of each
   * task being passed to the next promise in the chain. Utilize the
   * `accumulator` function to execute the list of processes.
   */
  serialize<T>(
    initialValue: Result<*>,
    items: T[],
    accumulator: ResultAccumulator<*, T>,
  ): ResultPromise<*> {
    return items.reduce((promise: ResultPromise<*>, item: T) => (
      promise.then((value: Result<*>) => accumulator(value, item))
    ), Promise.resolve(initialValue));
  }

  /**
   * Execute subroutines in sequential (serial) order.
   */
  serializeSubroutines(value: Result<*>): ResultPromise<*> {
    return this.serialize(value, this.subroutines, this.executeSubroutine);
  }

  /**
   * Execute tasks in sequential (serial) order.
   */
  serializeTasks(value: Result<*>, tasks: Task<*>[]): ResultPromise<*> {
    return this.serialize(value, tasks, this.executeTask);
  }

  /**
   * Called once the routine has been configured and is ready to execute.
   */
  setup() {}

  /**
   * Wrap a value in a promise if it has not already been.
   */
  wrapPromise(value: Result<*>): ResultPromise<*> {
    return (value instanceof Promise) ? value : Promise.resolve(value);
  }
}
