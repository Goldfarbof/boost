# Logging - Boost

[![Build Status](https://github.com/milesj/boost/workflows/Build/badge.svg)](https://github.com/milesj/boost/actions?query=branch%3Amaster)
[![npm version](https://badge.fury.io/js/%40boost%2Flog.svg)](https://www.npmjs.com/package/@boost/log)
[![npm deps](https://david-dm.org/milesj/boost.svg?path=packages/log)](https://www.npmjs.com/package/@boost/log)

Lightweight level based logging system.

```ts
import { createLogger } from '@boost/log';

const log = createLogger();

log('Something has happened…');
```

## Features

- Isolated logger instances.
- Supports 6 logging levels, in order of priority: log, trace, debug, info, warn, error.
- Handles default and max logging levels.
- Customizable transports with writable streams.
- Toggleable logging at runtime.

## Installation

```
yarn add @boost/log
```

## Documentation

- [https://boostlib.dev/docs/log](https://boostlib.dev/docs/log)
- [https://boostlib.dev/api/log](https://boostlib.dev/api/log)
