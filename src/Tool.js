/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import chalk from 'chalk';
import ConfigLoader from './ConfigLoader';
import Plugin from './Plugin';
import PluginLoader from './PluginLoader';
import Renderer from './Renderer';
import isEmptyObject from './helpers/isEmptyObject';

import type { CommandOptions, ToolConfig, PackageConfig } from './types';

export default class Tool {
  appName: string;
  command: CommandOptions;
  config: ToolConfig;
  debugs: string[] = [];
  debugGroups: string[] = [];
  package: PackageConfig;
  plugins: Plugin[] = [];
  renderer: Renderer;

  constructor(appName: string, renderer?: Renderer) {
    this.appName = appName;
    this.renderer = renderer || new Renderer();
  }

  /**
   * Close the current Vorpal interface instance.
   */
  closeConsole(): this {
    // TODO
    return this;
  }

  /**
   * Log a message only when debug is enabled.
   */
  debug(message: string): this {
    if (this.config.debug) {
      this.debugs.push(
        `${chalk.blue('[debug]')} ${this.renderer.indent(this.debugGroups.length)}${message}`,
      );
    }

    return this;
  }

  /**
   * Logs a debug message based on a conditional.
   */
  invariant(condition: boolean, message: string, pass: string, fail: string): this {
    this.debug(`${message}: ${condition ? chalk.green(pass) : chalk.red(fail)}`);

    return this;
  }

  /**
   * Load the package.json and local configuration files.
   *
   * Must be called first in the lifecycle.
   */
  loadConfig(): this {
    if (this.package || this.config) {
      return this;
    }

    const configLoader = new ConfigLoader(this.appName);

    this.package = configLoader.loadPackageJSON();
    this.config = configLoader.loadConfig();

    return this;
  }

  /**
   * Register plugins from the loaded configuration.
   *
   * Must be called after config has been loaded.
   */
  loadPlugins(): this {
    if (isEmptyObject(this.config)) {
      throw new Error('Cannot load plugins as configuration has not been loaded.');
    }

    const pluginLoader = new PluginLoader(this.appName);

    this.plugins = pluginLoader.loadPlugins(this.config.plugins || []);

    return this;
  }

  /**
   * Trigger a render.
   */
  render(): this {
    // TODO
    return this;
  }

  /**
   * Set the currently active command options passed down by Vorpal.
   */
  setCommand(command?: CommandOptions): this {
    if (this.command) {
      throw new Error('Command options have already been defined, cannot redefine.');
    }

    this.command = command || { options: {} };

    return this;
  }

  /**
   * Start a debug capturing group, which will indent all incoming debug messages.
   */
  startDebugGroup(group: string): this {
    this.debug(chalk.gray(`[${group}]`));
    this.debugGroups.push(group);

    return this;
  }

  /**
   * End the current debug capturing group.
   */
  stopDebugGroup(): this {
    this.debugGroups.pop();

    return this;
  }
}
