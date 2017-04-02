/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import Routine from './Routine';
import Console from './Console';

import type { RoutineConfig, Result, ResultPromise } from './types';

export default class Pipeline extends Routine {
  constructor(name: string, config: RoutineConfig = {}) {
    super(name, config);

    // Define the global config
    this.globalConfig = config;

    // Initialize the root console
    this.console = new Console(config);
  }

  /**
   * Execute all subroutines in order.
   */
  run(initialValue: Result<*> = null): ResultPromise<*> {
    return this.serializeSubroutines(initialValue)
      // $FlowIgnore
      .finally(() => {
        this.console.close();
      });
  }
}
