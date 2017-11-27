/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import chalk from 'chalk';
import pluralize from 'pluralize';
import Options, { bool, string } from 'optimal';
import ConfigLoader from './ConfigLoader';
import Console from './Console';
import Emitter from './Emitter';
import ModuleLoader from './ModuleLoader';
import Plugin from './Plugin';
import Reporter from './Reporter';
import isEmptyObject from './helpers/isEmptyObject';
import { DEFAULT_TOOL_CONFIG } from './constants';

import type { ToolConfig, ToolOptions, PackageConfig } from './types';

export default class Tool<Tp: Plugin<*>, Tr: Reporter<*>> extends Emitter {
  config: ToolConfig = { ...DEFAULT_TOOL_CONFIG };

  configLoader: ConfigLoader;

  console: Console<Tr>;

  initialized: boolean = false;

  options: ToolOptions;

  package: PackageConfig;

  pluginLoader: ModuleLoader<Tp>;

  plugins: Tp[] = [];

  reporterLoader: ModuleLoader<Tr>;

  reporter: Tr;

  constructor(options: Object) {
    super();

    this.options = new Options(options, {
      appName: string(),
      pluginName: string('plugin'),
      root: string(process.cwd()),
      scoped: bool(),
      title: string().empty(),
    }, {
      name: 'Tool',
    });

    // Avoid binding listeners while testing
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Cleanup when an exit occurs
    process.on('exit', (code) => {
      this.emit('exit', null, [code]);
    });
  }

  /**
   * Log a message only when debug is enabled.
   */
  debug(message: string): this {
    if (this.config.debug) {
      this.console.debug(message);
    }

    return this;
  }

  /**
   * Force exit the application.
   */
  exit(message: string | Error, code?: number = 1): this {
    this.console.exit(message, code);

    return this;
  }

  /**
   * Get a plugin by name.
   */
  getPlugin(name: string): Tp {
    const plugin = this.plugins.find(p => p.name === name);

    if (!plugin) {
      throw new Error(
        `Failed to find ${this.options.pluginName} "${name}". Have you installed it?`,
      );
    }

    return plugin;
  }

  /**
   * Initialize the tool by loading config and plugins.
   */
  initialize(): this {
    if (this.initialized) {
      return this;
    }

    this.loadConfig();
    this.loadPlugins();
    this.loadReporter();
    this.console = new Console(this.reporter);
    this.initialized = true;

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
    if (this.initialized) {
      return this;
    }

    this.configLoader = new ConfigLoader(this.options);
    this.package = this.configLoader.loadPackageJSON();
    this.config = this.configLoader.loadConfig();

    return this;
  }

  /**
   * Register plugins from the loaded configuration.
   *
   * Must be called after config has been loaded.
   */
  loadPlugins(): this {
    if (this.initialized) {
      return this;
    }

    const { pluginName } = this.options;
    const pluralPluginName = pluralize(pluginName);

    if (isEmptyObject(this.config)) {
      throw new Error(`Cannot load ${pluralPluginName} as configuration has not been loaded.`);
    }

    this.pluginLoader = new ModuleLoader(pluginName, Plugin, this.options);
    this.plugins = this.pluginLoader.loadModules(this.config[pluralPluginName]);

    // Sort plugins by priority
    this.plugins.sort((a, b) => a.priority - b.priority);

    // Bootstrap each plugin with the tool
    this.plugins.forEach((plugin) => {
      plugin.tool = this; // eslint-disable-line no-param-reassign
      plugin.bootstrap();
    });

    return this;
  }

  /**
   * Register a reporter from the loaded configuration.
   *
   * Must be called after config has been loaded.
   */
  loadReporter(): this {
    if (this.initialized) {
      return this;
    }

    if (isEmptyObject(this.config)) {
      throw new Error('Cannot load reporter as configuration has not been loaded.');
    }

    const reporterName = this.config.reporter;

    // Use native Boost reporter
    if (!reporterName) {
      // $FlowIgnore Temporarily
      this.reporter = new Reporter({ silent: this.config.silent });

      return this;
    }

    // Attempt to load reporter
    this.reporterLoader = new ModuleLoader('reporter', Reporter, this.options);

    const reporters = this.reporterLoader.loadModules([reporterName]);

    if (reporters.length === 0) {
      throw new Error('Reporter failed to load. Has it been configured?');
    }

    this.reporter = reporters.pop();

    return this;
  }

  /**
   * Add a message to the output log.
   */
  log(message: string): this {
    this.console.log(message);

    return this;
  }

  /**
   * Add a message to the logError log.
   */
  logError(message: string): this {
    this.console.error(message);

    return this;
  }
}
