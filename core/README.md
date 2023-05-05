# @perseid/core

⚙️ Contains isomorphic core features, types definitions and helpers necessary to other `@perseid` packages


## Installation

```bash
yarn add @perseid/core
```

## Features

### Id

Isomorphic universally unique identifiers generator.
Inspired from mongodb's ObjectId implementation and Snowflake algorithm.
An id is a 12-byte value, constructed as follows:
 - A 4-byte timestamp
 - A 5-byte process-specific id
 - A 3-byte script-specific id

#### Usage

```ts
new Id(value?: string);
```

#### Example

```ts
const myFirstId = new Id(); // Generates a new id.
const mySecondId = new Id('645394d3894e3d9b43dc8825'); // Instanciates Id with given existing value.
```

### Logger

Abstract class that represents a logging system.
Extend this class with a real implementation depending on the environment (node/browser).

#### Usage

```ts
abstract class Logger;
```

#### Example

```ts
class MyLogger extends Logger {
  // ...
}
```

### forEach

Implementation of JS `Array.forEach` method, adapted to asynchronous callbacks.

#### Usage

```ts
async function forEach<T>(
  items: T[], // Items to iterate on.
  callback: (item: T, index: number) => Promise<void>, // Asynchronous function to execute for each item.
): Promise<void>
```

#### Example

```ts
// The following will always log "one", "two", and "three" in this exact order.
await forEach(['one', 'two', 'three'], async (item) => {
  console.log(item);
  await new Promise((resolve) => { setTimeout(resolve, 1000); });
});
```


## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) Openizr. All Rights Reserved.
