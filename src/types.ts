/**
 * @copyright   2017-2018, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 */

import debug from 'debug';
import { Blueprint, Struct } from 'optimal';

export interface Debugger extends debug.IDebugger {
  invariant(condition: boolean, message: string, pass: string, fail: string): void;
}

export interface Context {
  [key: string]: any;
}

export interface PluginConfig {
  plugin: string;
  [key: string]: any;
}

export interface ReporterConfig {
  reporter: string;
  [key: string]: any;
}

export interface ToolConfig extends Struct {
  debug: boolean;
  extends: string | string[];
  plugins: (string | PluginConfig)[];
  reporter: string | ReporterConfig;
  silent: boolean;
  [key: string]: any;
}

export interface PackageConfig extends Struct {
  name: string;
}

export type Status = 'pending' | 'running' | 'skipped' | 'passed' | 'failed';
