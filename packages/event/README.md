# Events - Boost

[![Build Status](https://github.com/milesj/boost/workflows/Build/badge.svg)](https://github.com/milesj/boost/actions?query=branch%3Amaster)
[![npm version](https://badge.fury.io/js/%40boost%2Fevent.svg)](https://www.npmjs.com/package/@boost/event)
[![npm deps](https://david-dm.org/milesj/boost.svg?path=packages/event)](https://www.npmjs.com/package/@boost/event)

A strict event system with multiple emitter patterns.

```ts
import { Event } from '@boost/event';

const event = new Event<[string, number]>('name');

event.listen(listener);
event.emit(['abc', 123]);
```

## Features

- Isolated event instances for proper type-safety.
- Supports 4 event types: standard, bail, concurrent, and waterfall.
- Listener scopes for targeted emits.

## Installation

```
yarn add @boost/event
```

## Documentation

- [https://boostlib.dev/docs/event](https://boostlib.dev/docs/event)
- [https://boostlib.dev/api/event](https://boostlib.dev/api/event)
