import { describe, expect, test, vi } from "vitest";
import fakerestDataProvider from "ra-data-fakerest";
import type { DataProvider } from "ra-core";
import isEqual from "lodash/isEqual";
import {
  applyMiddlewares,
  type DataProviderMethodMiddleware,
  type DataProviderMethods,
} from "./main";

describe("withMiddlewares", () => {
  const baseDataProvider = fakerestDataProvider(
    {
      posts: [
        { id: 1, title: "Hello, world!" },
        { id: 2, title: "FooBar" },
      ],
      comments: [
        { id: 1, post_id: 1, body: "Lorem ipsum" },
        { id: 2, post_id: 2, body: "FooBar" },
      ],
    },
    false,
  );

  const loggingMiddleware =
    <
      DataProviderType extends DataProvider,
      Method extends DataProviderMethods<DataProviderType>,
    >(
      _dataProvider: DataProviderType,
      method: Method,
    ): DataProviderMethodMiddleware<DataProviderType, Method> =>
    (next: (...args: any[]) => any, ...args: any[]) => {
      console.log(method, ...args);
      next(...args);
    };

  const dontUpdateMainResourceMiddleware: DataProviderMethodMiddleware<
    typeof baseDataProvider,
    "update"
  > = (next, resource, params) => {
    if (resource !== "posts") {
      return next(resource, params);
    }

    if (isEqual(params.data, params.previousData)) {
      return Promise.resolve({ data: params.previousData });
    }
    return next(resource, params);
  };

  const auditLogMiddleware: DataProviderMethodMiddleware<
    typeof baseDataProvider,
    "update"
  > = (next, resource, params) => {
    return next(resource, {
      ...params,
      data: {
        ...params.data,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  test("should call the middlewares", async () => {
    using _fakeConsole = createConsoleInterceptor();
    const loggingMiddlewareSpy = vi.fn(
      loggingMiddleware(baseDataProvider, "getList"),
    );

    const dataProvider = applyMiddlewares(baseDataProvider, {
      getList: [loggingMiddlewareSpy, loggingMiddlewareSpy],
    });

    await dataProvider.getList("posts", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    expect(loggingMiddlewareSpy).toHaveBeenCalledTimes(2);
    expect(loggingMiddlewareSpy).toHaveBeenCalledWith(
      expect.any(Function),
      "posts",
      {
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      },
    );
  });

  test("should allow to bypass the dataProvider method", () => {
    const dataProvider = applyMiddlewares(baseDataProvider, {
      update: [dontUpdateMainResourceMiddleware],
    });
    const updateSpy = vi.spyOn(baseDataProvider, "update");
    dataProvider.update("posts", {
      id: 1,
      data: { id: 1, title: "Hello, world!" },
      previousData: { id: 1, title: "Hello, world!" },
    });
    expect(updateSpy).not.toHaveBeenCalled();
    dataProvider.update("comments", {
      id: 1,
      data: { id: 1, title: "Hello, world!" },
      previousData: { id: 1, title: "Hello, world!" },
    });
    expect(updateSpy).toHaveBeenCalledWith("comments", {
      id: 1,
      data: { id: 1, title: "Hello, world!" },
      previousData: { id: 1, title: "Hello, world!" },
    });
  });

  test("should allow to alter the dataProvider parameters", () => {
    const dataProvider = applyMiddlewares(baseDataProvider, {
      update: [auditLogMiddleware],
    });
    const updateSpy = vi.spyOn(baseDataProvider, "update");
    dataProvider.update("posts", {
      id: 1,
      data: { id: 1, title: "Hello, world!" },
      previousData: { id: 1, title: "Hello, world!" },
    });
    expect(updateSpy).toHaveBeenCalledWith("posts", {
      id: 1,
      data: { id: 1, title: "Hello, world!", updatedAt: expect.any(String) },
      previousData: { id: 1, title: "Hello, world!" },
    });
  });

  const dataProviderWithCustomMethod = {
    ...baseDataProvider,
    customMethod(_params: { value: boolean }) {
      return Promise.resolve({ data: "done" });
    },
  };

  test("should call the middlewares for custom methods", () => {
    using _fakeConsole = createConsoleInterceptor();
    const loggingMiddlewareSpy = vi.fn(
      loggingMiddleware(dataProviderWithCustomMethod, "customMethod"),
    );
    const dataProvider = applyMiddlewares(dataProviderWithCustomMethod, {
      customMethod: [loggingMiddlewareSpy, loggingMiddlewareSpy],
    });
    dataProvider.customMethod({ value: true });
    expect(loggingMiddlewareSpy).toHaveBeenCalledTimes(2);
    expect(loggingMiddlewareSpy).toHaveBeenCalledWith(expect.any(Function), {
      value: true,
    });
  });
});

// Ensure the console.log spy is restored after each test, whether they pass or not
export function createConsoleInterceptor() {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  return {
    // @ts-expect-error The tsconfig references ES2022 in libs but we need ESNext in tests only to use Symbol.dispose
    [Symbol.dispose]() {
      // Close the server, abort pending requests, etc.
      spy.mockReset();
    },
  };
}
