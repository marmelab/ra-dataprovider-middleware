import type { DataProvider } from "ra-core";

/*
 * A function that apply middlewares on a DataProvider.
 * Each middleware is called for every method with the following parameters:
 * - next: the next middleware function
 * - method: the name of the DataProvider method that was called initially
 * - all the arguments of the DataProvider method
 *
 * @example
 * const loggingMiddleware: DataProviderMethodMiddleware<
 *     typeof dataProviderWithCustomMethod
 * > = (next, method, ...args) => {
 *     console.log(method, ...args);
 *     next(method, ...args);
 * };
 *
 * const dataProvider = applyMiddlewares(fakerestDataProvider(
 *     {
 *         posts: [
 *             { id: 1, title: "Hello, world!" },
 *             { id: 2, title: "FooBar" },
 *         ],
 *     }
 * ), [loggingMiddleware]);
 */
export const applyMiddlewares = <DataProviderType extends DataProvider>(
  dataProvider: DataProviderType,
  middlewares: DataProviderMiddlewares<DataProviderType>,
) => {
  const proxy = new Proxy(dataProvider, {
    get(target, prop) {
      return (...args: any[]) => {
        if (typeof prop !== "string") {
          return (target as any)[prop](...args);
        }
        const method = prop as keyof typeof middlewares;
        const middlewaresToApply: DataProviderMethodMiddleware<DataProviderType>[] = middlewares[method] ?? [];

        const invokeChain = middlewaresToApply.reduceRight(
          (next, middleware) => () => {
            // @ts-expect-error We can't know the type here
            return middleware(next, ...args);
          },
          (...args: any[]) => {
            return (target[method] as any)(...args);
          },
        );

        return invokeChain(method, ...args);
      };
    },
  });
  return proxy;
};

export type DataProviderMiddlewares<DataProviderType extends DataProvider> = {
  [Method in DataProviderMethods<DataProviderType>]?: DataProviderMethodMiddleware<DataProviderType, Method>[];
};

export type DataProviderMethods<DataProviderType extends DataProvider> = keyof Omit<
  OmitIndexSignature<DataProviderType>,
  "supportAbortSignal"
>;

export type DataProviderMethodMiddleware<
  DataProviderType extends DataProvider,
  Method extends DataProviderMethods<DataProviderType> = DataProviderMethods<DataProviderType>,
> = (
  next: (...args: Parameters<DataProviderType[Method]>) => Promise<ReturnType<DataProviderType[Method]>>,
  ...args: Parameters<DataProviderType[Method]>
) => any;

export type OmitIndexSignature<ObjectType> = {
  [KeyType in keyof ObjectType as {} extends Record<KeyType, unknown> ? never : KeyType]: ObjectType[KeyType];
};
