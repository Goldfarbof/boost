/**
 * @copyright   2017-2018, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 */

import Reporter, { ReporterOptions } from '../Reporter';

export default class ErrorReporter extends Reporter<any, ReporterOptions> {
  bootstrap() {
    this.console.on('error', this.handleError);
  }

  handleError = (error: Error) => {
    this.displayError(error);
  };
}
