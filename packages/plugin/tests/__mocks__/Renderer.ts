import { Blueprint, Predicates } from '@boost/common';
import { DEFAULT_PRIORITY, Pluggable, Plugin, Registry, RegistryOptions } from '../../src';

export interface Renderable extends Pluggable {
  render: () => string;
}

export class Renderer extends Plugin<unknown, { value: string }> implements Renderable {
  name = '';

  priority = DEFAULT_PRIORITY;

  blueprint({ string }: Predicates): Blueprint<{ value: string }> {
    return {
      value: string(),
    };
  }

  render() {
    return 'test';
  }
}

export function createRendererRegistry(options?: RegistryOptions<Renderable>) {
  return new Registry<Renderable>('boost-test', 'renderer', {
    validate(plugin) {
      if (typeof plugin.render !== 'function') {
        throw new TypeError('Renderer requires a `render()` method.');
      }
    },
    ...options,
  });
}
