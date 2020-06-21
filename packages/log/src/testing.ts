/* eslint-disable jest/prefer-spy-on */

import { Logger } from './types';

export function mockLogger(): Logger {
  const log = jest.fn() as any;

  log.disable = jest.fn();
  log.enable = jest.fn();
  log.debug = jest.fn();
  log.error = jest.fn();
  log.log = jest.fn();
  log.info = jest.fn();
  log.trace = jest.fn();
  log.warn = jest.fn();

  return log;
}
