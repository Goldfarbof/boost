/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import fs from 'fs';
import Routine from './Routine';

import type { Result, ResultPromise } from './types';

export default class Pipeline extends Routine {

  /**
   * Instantiate a pipeline instance from a configuration file.
   */
  static fromConfig(configPath: string): Pipeline {
    return new Pipeline('pipes', JSON.parse(fs.readFileSync(configPath, 'utf8')));
  }

  /**
   * Execute the routines in sequential order while passing the result
   * from the previous routine to the next routine. The initial value can
   * be passed by the consumer.
   */
  execute(initialValue: Result<*> = null): ResultPromise<*> {
    try {
      return this.serializeSubroutines(initialValue);
    } catch (e) {
      // Catch all errors that happen down the tree
      // and do something with them.
      throw e;
    }
  }

  /**
   * Add a routine using pipeline terminology.
   */
  pipe(routine: Routine): this {
    return this.chain(routine);
  }
}
