/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import fs from 'fs';
import glob from 'glob';
import path from 'path';
import JSON5 from 'json5';
import camelCase from 'lodash/camelCase';
import mergeWith from 'lodash/mergeWith';
import formatPluginModuleName from './helpers/formatPluginModuleName';
import isObject from './helpers/isObject';
import isEmptyObject from './helpers/isEmptyObject';
import requireModule from './helpers/requireModule';
import {
  MODULE_NAME_PATTERN,
  PLUGIN_NAME_PATTERN,
  DEFAULT_TOOL_CONFIG,
  DEFAULT_PACKAGE_CONFIG,
} from './constants';

import type { ToolConfig, ToolOptions, PackageConfig } from './types';

export default class ConfigLoader {
  config: ToolConfig;

  options: ToolOptions;

  package: PackageConfig;

  parsedFiles: { [key: string]: boolean } = {};

  constructor(options: ToolOptions) {
    this.options = options;
  }

  /**
   * Handle special cases when merging 2 configuration values.
   * If the target and source are both arrays, concatenate them.
   */
  handleMerge(target: *, source: *): * {
    if (Array.isArray(target) && Array.isArray(source)) {
      return Array.from(new Set([
        ...target,
        ...source,
      ]));
    }

    // Defer to lodash
    return undefined;
  }

  /**
   * Load a local configuration file relative to the current working directory,
   * or from within a package.json property of the same appName.
   *
   * Support both JSON and JS file formats by globbing the config directory.
   */
  loadConfig(): ToolConfig {
    if (isEmptyObject(this.package)) {
      throw new Error('Cannot load configuration as "package.json" has not been loaded.');
    }

    const { appName, root } = this.options;
    const camelName = camelCase(appName);
    let config = {};

    // Config has been defined in package.json
    if (this.package[camelName]) {
      config = this.package[camelName];

      // Extend from a preset if a string
      if (typeof config === 'string') {
        config = { extends: config };
      }

    // Locate files within a local config folder
    } else {
      const filePaths = glob.sync(
        path.join(root, `config/${appName}.{js,json,json5}`),
        { absolute: true },
      );

      if (filePaths.length === 0) {
        throw new Error(
          'Local configuration file could not be found. ' +
          `One of "config/${appName}.js" or "config/${appName}.json" must exist ` +
          'relative to the project root.',
        );

      } else if (filePaths.length !== 1) {
        throw new Error(
          `Multiple "${appName}" configuration files found. Only 1 may exist.`,
        );
      }

      [config] = filePaths;
    }

    // Parse and extend configuration
    this.config = {
      ...DEFAULT_TOOL_CONFIG,
      ...this.parseAndExtend(config),
    };

    return this.config;
  }

  /**
   * Load the "package.json" from the current working directory,
   * as we require the build tool to be ran from the project root.
   */
  loadPackageJSON(): PackageConfig {
    const filePath = path.join(this.options.root, 'package.json');

    console.log(filePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(
        'Local "package.json" could not be found. ' +
        'Please run the command in your project\'s root.',
      );
    }

    this.package = {
      ...DEFAULT_PACKAGE_CONFIG,
      ...this.parseFile(filePath),
    };

    return this.package;
  }

  /**
   * If an `extends` option exists, recursively merge the current configuration
   * with the preset configurations defined within `extends`,
   * and return the new configuration object.
   */
  parseAndExtend(fileOrConfig: string | Object): Object {
    let config;

    // Parse out the object if a file path
    if (typeof fileOrConfig === 'string') {
      config = this.parseFile(fileOrConfig);
    } else {
      config = fileOrConfig;
    }

    // Verify we're working with an object
    if (!isObject(config)) {
      throw new Error('Invalid configuration. Must be a plain object.');
    }

    const { extends: extendPaths } = config;

    // Nothing to extend, so return the current config
    if (!extendPaths || extendPaths.length === 0) {
      return config;
    }

    // Resolve extend paths and inherit their config
    const nextConfig = {};
    const resolvedPaths = this.resolveExtendPaths(extendPaths);

    resolvedPaths.forEach((extendPath) => {
      if (this.parsedFiles[extendPath]) {
        return;
      }

      if (!fs.existsSync(extendPath)) {
        throw new Error(`Preset configuration ${extendPath} does not exist.`);

      } else if (!fs.statSync(extendPath).isFile()) {
        throw new Error(`Preset configuration ${extendPath} must be a valid file.`);
      }

      mergeWith(nextConfig, this.parseAndExtend(extendPath), this.handleMerge);
    });

    // Apply the current config after extending preset configs
    config.extends = resolvedPaths;

    mergeWith(nextConfig, config, this.handleMerge);

    return nextConfig;
  }

  /**
   * Parse a configuration file at the defined file system path.
   * If the file ends in "json" or "json5", parse it with JSON5.
   * If the file ends in "js", import the file and use the default object.
   * Otherwise throw an error.
   */
  parseFile(filePath: string, options?: Object = {}): Object {
    const name = path.basename(filePath);
    const ext = path.extname(filePath);
    let value;

    if (ext === '.json' || ext === '.json5') {
      value = JSON5.parse(fs.readFileSync(filePath, 'utf8'));

    } else if (ext === '.js') {
      value = requireModule(filePath);

      if (typeof value === 'function') {
        value = value(options);
      }

    } else {
      throw new Error(`Unsupported configuration file format "${name}".`);
    }

    if (!isObject(value)) {
      throw new Error(`Invalid configuration file "${name}". Must return an object.`);
    }

    this.parsedFiles[filePath] = true;

    return value;
  }

  /**
   * Resolve file system paths for the `extends` configuration value
   * using the following guidelines:
   *
   *  - Absolute paths should be normalized and used as is.
   *  - Relative paths should be resolved relative to the CWD.
   *  - Strings that match a node module name should resolve to a config file relative to the CWD.
   *  - Strings that start with "<plugin>:" should adhere to the previous rule.
   */
  resolveExtendPaths(extendPaths: string | string[]): string[] {
    return (Array.isArray(extendPaths) ? extendPaths : [extendPaths]).map((extendPath) => {
      if (typeof extendPath !== 'string') {
        throw new TypeError(
          'Invalid `extends` configuration value. Must be a string or an array of strings.',
        );
      }

      const { appName, pluginName } = this.options;

      // Absolute path, use it directly
      if (path.isAbsolute(extendPath)) {
        return path.normalize(extendPath);

      // Relative path, resolve with cwd
      } else if (extendPath[0] === '.') {
        return path.resolve(extendPath);

      // Node module, resolve to a config file
      } else if (extendPath.match(MODULE_NAME_PATTERN)) {
        return this.resolveModuleConfigPath(appName, extendPath, true);

      // Plugin, resolve to a node module
      } else if (extendPath.match(PLUGIN_NAME_PATTERN)) {
        return this.resolveModuleConfigPath(
          appName,
          formatPluginModuleName(appName, pluginName, extendPath),
          true,
        );
      }

      throw new Error(`Invalid \`extends\` configuration value "${extendPath}".`);
    });
  }

  /**
   * Resolve a Node/NPM module path to an app config file.
   */
  resolveModuleConfigPath(
    appName: string,
    moduleName: string,
    preset?: boolean = false,
    ext?: string = 'js',
  ): string {
    const fileName = preset ? `${appName}.preset.${ext}` : `${appName}.${ext}`;

    return path.resolve('node_modules', moduleName, `config/${fileName}`);
  }
}
