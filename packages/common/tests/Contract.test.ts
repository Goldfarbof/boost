import { Contract, Predicates } from '../src';

describe('Contract', () => {
  class OptionalProps extends Contract<{ foo?: string; bar?: number; baz?: { qux: string } }> {
    blueprint({ number, string, shape }: Predicates) {
      return {
        foo: string('default'),
        bar: number(),
        baz: shape({ qux: string() }),
      };
    }
  }

  class RequiredProps extends Contract<{ bar: number }> {
    // eslint-disable-next-line no-useless-constructor
    constructor(options: { bar: number }) {
      super(options);
    }

    blueprint({ number }: Predicates) {
      return {
        bar: number().required(),
      };
    }
  }

  describe('constructor()', () => {
    it('errors for invalid option type passed', () => {
      expect(
        () =>
          new OptionalProps({
            // @ts-expect-error
            foo: 123,
          }),
      ).toThrowErrorMatchingSnapshot();
    });

    it('errors for unknown option', () => {
      expect(
        () =>
          new OptionalProps({
            // @ts-expect-error
            unknown: 'abc',
          }),
      ).toThrowErrorMatchingSnapshot();
    });

    it('sets options', () => {
      const opts = new OptionalProps({
        foo: 'custom',
      });

      expect(opts.options.foo).toBe('custom');
    });

    it('inherits option defaults', () => {
      const opts = new OptionalProps();

      expect(opts.options.foo).toBe('default');
    });

    it('requires non-optional options to be passed', () => {
      expect(
        () =>
          // @ts-expect-error
          new RequiredProps(),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('configure()', () => {
    let opts: OptionalProps;

    beforeEach(() => {
      opts = new OptionalProps();
    });

    it('errors for invalid option type passed', () => {
      expect(() => {
        opts.configure({
          // @ts-expect-error
          foo: 123,
        });
      }).toThrowErrorMatchingSnapshot();
    });

    it('errors for unknown option', () => {
      expect(() => {
        opts.configure({
          // @ts-expect-error
          unknown: 'abc',
        });
      }).toThrowErrorMatchingSnapshot();
    });

    it('can set an option', () => {
      expect(opts.options.foo).toBe('default');

      opts.configure({
        foo: 'new',
      });

      expect(opts.options.foo).toBe('new');
    });

    it('can set an option using a callback function', () => {
      expect(opts.options.foo).toBe('default');

      opts.configure(prev => ({
        foo: `${prev.foo}-new`,
      }));

      expect(opts.options.foo).toBe('default-new');
    });

    it('persists other options not being configured', () => {
      opts = new OptionalProps({
        foo: 'abc',
        bar: 123,
      });

      expect(opts.options).toEqual({
        foo: 'abc',
        bar: 123,
        baz: { qux: '' },
      });

      opts.configure({
        bar: 456,
      });

      expect(opts.options).toEqual({
        foo: 'abc',
        bar: 456,
        baz: { qux: '' },
      });
    });

    it('freezes the object', () => {
      expect(() => {
        // @ts-expect-error
        opts.options.foo = 'override';
      }).toThrowErrorMatchingSnapshot();
    });
  });
});
