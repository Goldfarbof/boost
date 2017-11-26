import Pipeline from '../src/Pipeline';
import Routine from '../src/Routine';
import Tool from '../src/Tool';
import { MockRenderer } from './helpers';

jest.mock('../src/Console');

describe('Pipeline', () => {
  let tool;
  let pipeline;

  beforeEach(() => {
    tool = new Tool({
      appName: 'boost',
      renderer: new MockRenderer(),
    });
    tool.config = { foo: 'bar' };
    tool.initialized = true; // Avoid loaders

    pipeline = new Pipeline(tool);
  });

  describe('constructor()', () => {
    it('errors if no tool is passed', () => {
      expect(() => new Pipeline())
        .toThrowError('A build `Tool` instance is required to operate the pipeline.');
    });

    it('inherits config from tool', () => {
      expect(pipeline.config).toEqual({ foo: 'bar' });
    });
  });

  describe('loadTasks()', () => {
    it('returns an array of task results', () => {
      const foo = new Routine('foo', 'foo');
      const bar = new Routine('bar', 'bar');

      pipeline.pipe(foo, bar);

      expect(pipeline.loadTasks()).toEqual([foo, bar]);
    });
  });

  describe('run()', () => {
    it('stops console and displays output', async () => {
      const spy = jest.spyOn(pipeline.tool.console, 'displayOutput');
      const stopSpy = jest.spyOn(pipeline.tool.console, 'stop');

      await pipeline.run();

      expect(spy).toBeCalled();
      expect(stopSpy).toBeCalled();
    });

    it('stops console and displays error', async () => {
      class FailureRoutine extends Routine {
        execute() {
          throw new Error('Oops');
        }
      }

      const spy = jest.spyOn(pipeline.tool.console, 'displayError');
      const stopSpy = jest.spyOn(pipeline.tool.console, 'stop');

      try {
        await pipeline.pipe(new FailureRoutine('fail', 'title')).run();
      } catch (error) {
        expect(error).toEqual(new Error('Oops'));
      }

      expect(spy).toBeCalled();
      expect(stopSpy).toBeCalled();
    });
  });
});
