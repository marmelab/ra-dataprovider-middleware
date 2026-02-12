# ra-dataprovider-middleware

Add middlewares support to React Admin data providers.

## Installation

```sh
npm install ra-dataprovider-middleware
```

## Usage

This package exports a single `applyMiddlewares` method that takes a [dataProvider]() and an object that defines middlewares for each of the dataProvider methods:
```ts
import { dataProvider } from './dataProvider';
import {
  applyMiddlewares,
  type DataProviderMethodMiddleware,
} from 'ra-dataprovider-middleware';

const auditLogMiddleware: DataProviderMethodMiddleware<
  typeof dataProvider,
  'update'
> = (next, resource, params) => {
  return next(resource, {
    ...params,
    data: {
      ...params.data,
      updatedAt: new Date().toISOString(),
    },
  });
};

const dataProviderWithMiddlewares = applyMiddlewares(dataProvider, {
  update: [auditLogMiddleware],
});
```
