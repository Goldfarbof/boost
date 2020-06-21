import { vol } from 'memfs';
import { Predicates } from '@boost/common';
import { Configuration, createExtendsPredicate, mergeExtends } from '../src';
import { ExtType, ExtendsSetting } from '../src/types';
import { stubPath } from './helpers';
import { configFileTreeAllTypes, rootConfigJSON } from './__fixtures__/config-files-fs';
import { ignoreFileTree } from './__fixtures__/ignore-files-fs';

jest.mock('fs', () => require.requireActual('memfs').vol);

interface BoostConfig {
  debug: boolean;
  extends: ExtendsSetting;
  type: ExtType;
}

class BoostConfiguration extends Configuration<BoostConfig> {
  blueprint({ bool, string }: Predicates) {
    return {
      debug: bool(),
      extends: createExtendsPredicate(),
      type: string('js').oneOf<ExtType>(['js', 'cjs', 'mjs', 'json', 'yaml', 'yml']),
    };
  }

  bootstrap() {
    this.configureFinder({
      extendsSetting: 'extends',
    });

    this.configureProcessor({
      defaultWhenUndefined: false,
    });

    this.addProcessHandler('extends', mergeExtends);
  }
}

describe('Configuration', () => {
  let config: BoostConfiguration;

  beforeEach(() => {
    config = new BoostConfiguration('boost');

    vol.reset();
  });

  describe('clearCache()', () => {
    it('clears file and finder cache on cache engine', () => {
      // @ts-ignore Allow
      const spy1 = jest.spyOn(config.cache, 'clearFileCache');
      // @ts-ignore Allow
      const spy2 = jest.spyOn(config.cache, 'clearFinderCache');

      config.clearCache();

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });
  });

  describe('clearFileCache()', () => {
    it('clears file cache on cache engine', () => {
      // @ts-ignore Allow
      const spy = jest.spyOn(config.cache, 'clearFileCache');

      config.clearFileCache();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('clearFinderCache()', () => {
    it('clears finder cache on cache engine', () => {
      // @ts-ignore Allow
      const spy = jest.spyOn(config.cache, 'clearFinderCache');

      config.clearFinderCache();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('loadConfigFromBranchToRoot()', () => {
    it('loads and processes all configs', async () => {
      vol.fromJSON(configFileTreeAllTypes, '/test');

      const result = await config.loadConfigFromBranchToRoot('/test/src/app/profiles/settings');

      expect(result).toEqual({
        config: {
          debug: true,
          extends: [],
          type: 'yaml',
        },
        files: [
          {
            config: { debug: true },
            path: stubPath('/test/.config/boost.json'),
            source: 'root',
          },
          {
            config: { type: 'json' },
            path: stubPath('/test/src/.boost.json'),
            source: 'branch',
          },
          {
            config: { type: 'cjs' },
            path: stubPath('/test/src/app/.boost.cjs'),
            source: 'branch',
          },
          {
            config: { type: 'js' },
            path: stubPath('/test/src/app/profiles/.boost.js'),
            source: 'branch',
          },
          {
            config: { type: 'yaml' },
            path: stubPath('/test/src/app/profiles/settings/.boost.yaml'),
            source: 'branch',
          },
        ],
      });
    });
  });

  describe('loadConfigFromRoot()', () => {
    it('loads and processes root config', async () => {
      vol.fromJSON(rootConfigJSON, '/test');

      const result = await config.loadConfigFromRoot('/test');

      expect(result).toEqual({
        config: {
          debug: true,
          extends: [],
          type: 'js',
        },
        files: [
          {
            config: { debug: true },
            path: stubPath('/test/.config/boost.json'),
            source: 'root',
          },
        ],
      });
    });
  });

  describe('loadIgnoreFromBranchToRoot()', () => {
    it('loads all ignores', async () => {
      vol.fromJSON(ignoreFileTree, '/test');

      const result = await config.loadIgnoreFromBranchToRoot('/test/src/app/feature/signup/flow');

      expect(result).toEqual([
        {
          ignore: ['*.log', '*.lock'],
          path: stubPath('/test/.boostignore'),
          source: 'root',
        },
        {
          ignore: ['lib/'],
          path: stubPath('/test/src/app/feature/.boostignore'),
          source: 'branch',
        },
        {
          ignore: [],
          path: stubPath('/test/src/app/feature/signup/.boostignore'),
          source: 'branch',
        },
      ]);
    });
  });

  describe('loadIgnoreFromRoot()', () => {
    it('loads root ignore', async () => {
      vol.fromJSON(ignoreFileTree, '/test');

      const result = await config.loadIgnoreFromRoot('/test');

      expect(result).toEqual([
        {
          ignore: ['*.log', '*.lock'],
          path: stubPath('/test/.boostignore'),
          source: 'root',
        },
      ]);
    });
  });
});
