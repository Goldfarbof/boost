/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import type { Status, ToolConfig, PackageConfig } from './types';

export const APP_NAME_PATTERN: RegExp = /^[a-z-]+$/;
export const MODULE_NAME_PATTERN: RegExp = /^(@[a-z-]+\/)?[a-z-]+$/;
export const PLUGIN_NAME_PATTERN: RegExp = /^[a-z]+:[a-z-]+$/;

export const STATUS_PENDING: Status = 'pending';
export const STATUS_RUNNING: Status = 'running';
export const STATUS_SKIPPED: Status = 'skipped';
export const STATUS_PASSED: Status = 'passed';
export const STATUS_FAILED: Status = 'failed';

export const DEFAULT_PLUGIN_PRIORITY: number = 100;

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  debug: false,
  dry: false,
  extends: [],
  plugins: [],
};

export const DEFAULT_PACKAGE_CONFIG: PackageConfig = {
  name: '',
  version: '',
};

export const RESTRICTED_CONFIG_KEYS: string[] = Object.keys(DEFAULT_TOOL_CONFIG);
