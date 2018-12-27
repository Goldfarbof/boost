/**
 * @copyright   2017-2019, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 */

import { Status } from './types';

export const APP_NAME_PATTERN: RegExp = /^[-a-z.]+$/u;
export const MODULE_NAME_PATTERN: RegExp = /^(@[-a-z]+\/)?[-a-z]+$/u;
export const PLUGIN_NAME_PATTERN: RegExp = /^([a-z]+):[-a-z]+$/u;

export const STATUS_PENDING: Status = 'pending';
export const STATUS_RUNNING: Status = 'running';
export const STATUS_SKIPPED: Status = 'skipped';
export const STATUS_PASSED: Status = 'passed';
export const STATUS_FAILED: Status = 'failed';

// Chalk colors
// yellow = app name, module name
// cyan = file
// magenta = plugin name
