import React from 'react';
import { render } from 'ink';
import {
  ArgList,
  Arguments,
  Argv,
  parse,
  ParseError,
  parseInContext,
  PrimitiveType,
  ValidationError,
} from '@boost/args';
import { Predicates, Blueprint } from '@boost/common';
import { Event } from '@boost/event';
import { Logger, createLogger } from '@boost/log';
import { ExitError, env } from '@boost/internal';
import levenary from 'levenary';
import CLIError from './CLIError';
import Command from './Command';
import CommandManager from './CommandManager';
import LogBuffer from './LogBuffer';
import Failure from './Failure';
import Help from './Help';
import IndexHelp from './IndexHelp';
import Wrapper from './Wrapper';
import isArgvSize from './helpers/isArgvSize';
import mapCommandMetadata from './helpers/mapCommandMetadata';
import getConstructor from './metadata/getConstructor';
import removeProcessBin from './middleware/removeProcessBin';
import msg from './translate';
import {
  VERSION_FORMAT,
  EXIT_PASS,
  EXIT_FAIL,
  INTERNAL_OPTIONS,
  INTERNAL_PARAMS,
  INTERNAL_PROGRAM,
  DELIMITER,
} from './constants';
import {
  Commandable,
  CommandPath,
  ExitCode,
  GlobalOptions,
  ProgramOptions,
  ProgramStreams,
  RunResult,
  Middleware,
  MiddlewareCallback,
  MiddlewareArguments,
  Categories,
} from './types';

export default class Program extends CommandManager<ProgramOptions> {
  readonly onAfterRender = new Event('after-render');

  readonly onAfterRun = new Event<[Error?]>('after-run');

  readonly onBeforeRender = new Event<[RunResult]>('before-render');

  readonly onBeforeRun = new Event<[Argv]>('before-run');

  readonly onCommandFound = new Event<[Argv, CommandPath, Commandable]>('command-found');

  readonly onCommandNotFound = new Event<[Argv, CommandPath]>('command-not-found');

  readonly onExit = new Event<[string, ExitCode]>('exit');

  readonly onHelp = new Event<[CommandPath?]>('help');

  readonly streams: ProgramStreams = {
    stderr: process.stderr,
    stdin: process.stdin,
    stdout: process.stdout,
  };

  protected commandLine: string = '';

  protected logger: Logger;

  protected middlewares: Middleware[] = [removeProcessBin];

  protected rendering: boolean = false;

  protected sharedCategories: Categories = {
    global: {
      name: msg('cli:categoryGlobal'),
      weight: 100,
    },
  };

  protected standAlone: CommandPath = '';

  private errBuffer: LogBuffer;

  private outBuffer: LogBuffer;

  constructor(options: ProgramOptions, streams?: ProgramStreams) {
    super(options);

    Object.assign(this.streams, streams);

    this.errBuffer = new LogBuffer('stderr', this.streams.stderr);
    this.outBuffer = new LogBuffer('stdout', this.streams.stdout);

    this.logger = createLogger({
      stderr: this.errBuffer,
      stdout: this.outBuffer,
    });

    this.onAfterRegister.listen(this.handleAfterRegister);
    this.onBeforeRegister.listen(this.handleBeforeRegister);

    // istanbul ignore next
    // if (process.env.NODE_ENV !== 'test') {
    //   process.on('SIGINT', () => {
    //     this.errBuffer.unwrap();
    //     this.outBuffer.unwrap();
    //   });
    // }
  }

  blueprint({ string }: Predicates): Blueprint<ProgramOptions> {
    return {
      banner: string(),
      bin: string().notEmpty().required().kebabCase(),
      delimiter: string(DELIMITER),
      footer: string(),
      header: string(),
      name: string().notEmpty().required(),
      version: string().required().match(VERSION_FORMAT),
    };
  }

  /**
   * Define option and command categories to supply to the running command,
   * or the program itself.
   */
  categories(categories: Categories): this {
    Object.assign(this.sharedCategories, categories);

    return this;
  }

  /**
   * Register a command and its canonical path as the default command.
   * A default command should be used when stand-alone binary is required.
   */
  default(command: Commandable): this {
    if (Object.keys(this.commands).length > 0) {
      throw new CLIError('COMMAND_MIXED_NONDEFAULT');
    }

    this.register(command);
    this.standAlone = command.getPath();

    return this;
  }

  /**
   * Exit the program with an error code.
   * Should be called within a command or component.
   */
  exit = (message: string, code: ExitCode = 1) => {
    this.onExit.emit([message, code]);

    throw new ExitError(message, code);
  };

  /**
   * Define a middleware function to apply to the argv list or args object.
   */
  middleware(middleware: Middleware): this {
    if (typeof middleware !== 'function') {
      throw new CLIError('MIDDLEWARE_INVALID');
    }

    this.middlewares.push(middleware);

    return this;
  }

  /**
   * Parse the arguments list according to the number of commands that have been registered.
   */
  parse<O extends GlobalOptions, P extends PrimitiveType[] = ArgList>(argv: Argv): Arguments<O, P> {
    if (Object.keys(this.commands).length === 0) {
      throw new CLIError('COMMAND_NONE_REGISTERED');
    }

    if (this.standAlone) {
      return parse(argv, this.getCommand<O, P>(this.standAlone)!.getParserOptions());
    }

    try {
      return parseInContext(argv, (arg) => this.getCommand<O, P>(arg)?.getParserOptions());
    } catch {
      const [possibleCmd] = argv.filter((arg) => !arg.startsWith('-'));

      this.onCommandNotFound.emit([argv, possibleCmd]);

      if (possibleCmd) {
        const closestCmd = levenary(possibleCmd, this.getCommandPaths());

        throw new CLIError('COMMAND_UNKNOWN', [possibleCmd, closestCmd]);
      }

      throw new CLIError('COMMAND_INVALID_RUN');
    }
  }

  /**
   * Run the program in the following steps:
   *  - Apply middleware to argv list.
   *  - Parse argv into an args object (of options, params, etc).
   *  - Determine command to run, or fail.
   *  - Run command and render output.
   *  - Return exit code.
   */
  async run(argv: Argv, rethrow: boolean = false): Promise<ExitCode> {
    this.onBeforeRun.emit([argv]);

    let exitCode: ExitCode;

    try {
      exitCode = await this.runAndRender(argv);

      this.onAfterRun.emit([]);
    } catch (error) {
      exitCode = await this.renderErrors([error]);

      this.onAfterRun.emit([error]);

      if (rethrow) {
        throw error;
      }
    }

    return exitCode;
  }

  /**
   * Run the program and also set the process exit code.
   */
  // istanbul ignore next
  async runAndExit(argv: Argv): Promise<ExitCode> {
    const exitCode = await this.run(argv);

    process.exitCode = exitCode;

    return exitCode;
  }

  /**
   * Render the index screen when no args are passed.
   * Should include banner, header, footer, and command (if applicable).
   */
  protected createIndex(): React.ReactElement {
    if (this.standAlone) {
      return (
        <IndexHelp {...this.options}>{this.getCommand(this.standAlone)!.renderHelp()}</IndexHelp>
      );
    }

    const commands: { [key: string]: Commandable } = {};

    // Remove sub-commands
    Object.entries(this.commands).forEach(([path, command]) => {
      if (!path.includes(':')) {
        commands[path] = command;
      }
    });

    return (
      <IndexHelp {...this.options}>
        <Help
          header={msg('cli:labelAbout')}
          categories={this.sharedCategories}
          commands={mapCommandMetadata(commands)}
          delimiter={this.options.delimiter}
        />
      </IndexHelp>
    );
  }

  /**
   * Loop through all middleware to modify the argv list
   * and resulting args object.
   */
  protected applyMiddlewareAndParseArgs(
    argv: Argv,
  ): MiddlewareArguments | Promise<MiddlewareArguments> {
    let index = -1;

    const next: MiddlewareCallback = (nextArgv) => {
      index += 1;
      const middleware = this.middlewares[index];

      // Keep calling middleware until we exhaust them all
      if (middleware) {
        return middleware(nextArgv, next);
      }

      // Otherwise all middleware have ran, so parse the final list
      this.commandLine = nextArgv.join(' ');

      return this.parse(nextArgv);
    };

    return next(argv);
  }

  /**
   * Render the result of a command's run to the defined stream.
   * If a string has been returned, write it immediately.
   * If a React component, render with Ink and wait for it to finish.
   */
  protected async render(result: RunResult, exitCode: ExitCode = EXIT_PASS): Promise<ExitCode> {
    const { stdin, stdout, stderr } = this.streams;

    // For simple strings, ignore react and the buffer
    if (typeof result === 'string') {
      stdout.write(`${result}\n`);

      return exitCode;
    }

    // Do not allow this
    // istanbul ignore next
    if (this.rendering) {
      throw new CLIError('REACT_RENDER_NO_NESTED');
    }

    try {
      this.errBuffer.wrap();
      this.outBuffer.wrap();

      this.onBeforeRender.emit([result]);
      this.rendering = true;

      const output = await render(
        <Wrapper
          errBuffer={this.errBuffer}
          exit={this.exit}
          logger={this.logger}
          outBuffer={this.outBuffer}
          program={this.options}
        >
          {result || null}
        </Wrapper>,
        {
          debug: process.env.NODE_ENV === 'test',
          exitOnCtrlC: true,
          experimental: true,
          stderr,
          stdin,
          stdout,
        },
      );

      // This never resolves while testing
      // istanbul ignore next
      if (!env('CLI_TEST_ONLY')) {
        await output.waitUntilExit();
      }

      this.rendering = false;
      this.onAfterRender.emit([]);
    } finally {
      this.errBuffer.unwrap();
      this.outBuffer.unwrap();
    }

    return exitCode;
  }

  /**
   * Render an error and warnings menu based on the list provided.
   * If argument parser or validation errors are found, treat them with special logic.
   */
  protected renderErrors(errors: Error[]): Promise<ExitCode> {
    const parseErrors = errors.filter((error) => error instanceof ParseError);
    const validErrors = errors.filter((error) => error instanceof ValidationError);
    const error = parseErrors[0] ?? validErrors[0] ?? errors[0];

    // Mostly for testing, but useful for other things
    // istanbul ignore next
    if (env('CLI_TEST_FAIL_HARD')) {
      throw error;
    }

    return this.render(
      <Failure
        binName={this.options.bin}
        commandLine={this.commandLine}
        delimiter={this.options.delimiter}
        error={error}
        warnings={validErrors.filter((verror) => verror !== error)}
      />,
      error instanceof ExitError ? error.code : EXIT_FAIL,
    );
  }

  /**
   * Internal run that does all the heavy lifting and parsing,
   * while the public run exists to catch any unexpected errors.
   */
  protected async runAndRender(argv: Argv): Promise<ExitCode> {
    const showVersion = argv.some((arg) => arg === '-v' || arg === '--version');
    const showHelp = argv.some((arg) => arg === '-h' || arg === '--help');

    // Display index help
    if ((isArgvSize(argv, 0) && !this.standAlone) || (isArgvSize(argv, 1) && showHelp)) {
      this.onHelp.emit([]);

      return this.render(this.createIndex());
    }

    // Display version
    if (showVersion) {
      return this.render(this.options.version);
    }

    // Parse the arguments
    const {
      command: paths,
      errors,
      options,
      params,
      rest,
      unknown,
    } = await this.applyMiddlewareAndParseArgs(argv);
    const path = paths.join(':') || this.standAlone;
    const command = this.getCommand(path) as Command;

    this.onCommandFound.emit([argv, path, command]);

    // Apply shared categories to command constructor
    Object.assign(getConstructor(command).categories, this.sharedCategories);

    // Display command help
    if (options.help) {
      this.onHelp.emit([path]);

      return this.render(command.renderHelp());
    }

    // Display errors
    if (errors.length > 0) {
      return this.renderErrors(errors);
    }

    // Apply options to command properties
    Object.assign(command, options);

    // Apply remaining arguments and properties
    command.rest = rest;
    command.unknown = unknown;
    command.exit = this.exit;
    command.log = this.logger;
    command[INTERNAL_OPTIONS] = options;
    command[INTERNAL_PARAMS] = params;
    command[INTERNAL_PROGRAM] = this;

    return this.render(await command.run(...params), EXIT_PASS);
  }

  /**
   * Deeply register all commands so that we can easily access it during parse.
   */
  private handleAfterRegister = (_path: CommandPath, command: Commandable) => {
    const deepRegister = (cmd: Commandable) => {
      const { aliases, commands, path } = cmd.getMetadata();

      this.commands[path] = cmd;

      aliases.forEach((alias) => {
        this.commandAliases[alias] = path;
      });

      Object.values(commands).forEach(deepRegister);
    };

    deepRegister(command);
  };

  /**
   * Check for default and non-default command mixing.
   */
  private handleBeforeRegister = () => {
    if (this.standAlone) {
      throw new CLIError('COMMAND_MIXED_DEFAULT');
    }
  };
}
