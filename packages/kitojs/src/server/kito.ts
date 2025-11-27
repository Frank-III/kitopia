/**
 * Type-safe Kito Server
 *
 * This is the new multi-generic server class that provides Elysia-level
 * type safety while using the existing kito-core Rust backend.
 */

import type {
  Prettify,
  MaybePromise,
  JoinPath,
  ResolvePath,
  MaybeArray,
} from "../types/utils";

import type {
  SingletonBase,
  EmptySingleton,
  DefinitionBase,
  EmptyDefinitions,
  RouteSchema,
  EmptyRouteSchema,
  EphemeralType,
  EmptyEphemeral,
  VolatileType,
  EmptyVolatile,
  RouteBase,
  HTTPMethod,
  InputSchema,
  Context,
  Handler,
  InlineHandler,
  MergeSchema,
  UnwrapInputSchema,
  LifeCycleType,
  SchemaType,
  InferType,
} from "../types/base";

import type { CreateRoute, MergeRoutes } from "../types/routes";

// Inline ServerOptions to avoid circular dependency during type checking
interface ServerOptions {
  port?: number;
  host?: string;
  unixSocket?: string;
  trustProxy?: boolean;
  maxRequestSize?: number;
  timeout?: number;
  reusePort?: boolean;
}

// Stub type for KitoServer - the actual class is in ./server.ts
// This allows type checking without the full dependency chain
interface KitoServerStub<TExtensions = {}> {
  get(path: string, handler: unknown): this;
  get(path: string, middlewares: unknown[], handler: unknown): this;
  post(path: string, handler: unknown): this;
  post(path: string, middlewares: unknown[], handler: unknown): this;
  put(path: string, handler: unknown): this;
  put(path: string, middlewares: unknown[], handler: unknown): this;
  delete(path: string, handler: unknown): this;
  delete(path: string, middlewares: unknown[], handler: unknown): this;
  patch(path: string, handler: unknown): this;
  patch(path: string, middlewares: unknown[], handler: unknown): this;
  listen(port?: number, callback?: () => void): Promise<ServerOptions>;
  listen(callback?: () => void): Promise<ServerOptions>;
  close(): void;
}

// Dynamic import type for actual KitoServer
type KitoServer<T = {}> = KitoServerStub<T>;

// Factory to create KitoServer - will be replaced with actual import at runtime
function createKitoServer(options?: ServerOptions): KitoServer {
  // At runtime, this will be the actual KitoServer
  // For type checking, we use the stub
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { KitoServer } = require("./server");
    return new KitoServer(options);
  } catch {
    // Fallback stub that returns itself for method chaining
    const stub: KitoServer = {
      get: () => stub,
      post: () => stub,
      put: () => stub,
      delete: () => stub,
      patch: () => stub,
      listen: () => Promise.resolve({}),
      close: () => {},
    };
    return stub;
  }
}

// ============================================================================
// Type Aliases for Cleaner Signatures
// ============================================================================

type AnyKito = Kito<any, any, any, any, any, any>;

// ============================================================================
// Kito Configuration
// ============================================================================

export interface KitoConfig<Prefix extends string | undefined = undefined> {
  /**
   * Path prefix for all routes
   */
  prefix?: Prefix;
  /**
   * Server options passed to underlying kito-core
   */
  serve?: ServerOptions;
  /**
   * Name for plugin deduplication
   */
  name?: string;
}

// ============================================================================
// Main Kito Class
// ============================================================================

/**
 * Type-safe Kito Server
 *
 * @template BasePath - Path prefix for all routes
 * @template Singleton - Global state (store, derive, resolve, decorator)
 * @template Definitions - Schema definitions and errors
 * @template Routes - Accumulated routes for client generation
 * @template Ephemeral - Scoped state (for plugins)
 * @template Volatile - Local state (for single routes)
 *
 * @example
 * ```typescript
 * const app = new Kito()
 *   .state('version', '1.0.0')
 *   .derive(({ request }) => ({
 *     userAgent: request.headers.get('user-agent')
 *   }))
 *   .get('/users/:id', ({ params }) => {
 *     return { id: params.id }; // params.id is typed as string!
 *   })
 *   .listen(3000);
 * ```
 */
export class Kito<
  const BasePath extends string = "",
  const Singleton extends SingletonBase = EmptySingleton,
  const Definitions extends DefinitionBase = EmptyDefinitions,
  const Routes extends RouteBase = {},
  const Ephemeral extends EphemeralType = EmptyEphemeral,
  const Volatile extends VolatileType = EmptyVolatile,
> {
  // Type-level markers for inference
  readonly "~BasePath"!: BasePath;
  readonly "~Singleton"!: Singleton;
  readonly "~Definitions"!: Definitions;
  readonly "~Routes"!: Routes;
  readonly "~Ephemeral"!: Ephemeral;
  readonly "~Volatile"!: Volatile;

  // Internal state
  private config: KitoConfig<BasePath>;
  private internalServer: KitoServer<
    Singleton["decorator"] & Singleton["derive"] & Singleton["resolve"]
  >;

  // Runtime singleton storage
  private singletonStore: Record<string, unknown> = {};
  private deriveFunctions: Array<(ctx: unknown) => unknown> = [];
  private resolveFunctions: Array<(ctx: unknown) => unknown> = [];

  constructor(config: KitoConfig<BasePath> = {}) {
    this.config = config as KitoConfig<BasePath>;
    this.internalServer = createKitoServer(config.serve) as any;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Add a value to the global store
   *
   * @example
   * ```typescript
   * const app = new Kito()
   *   .state('counter', 0)
   *   .state('config', { debug: true })
   *   .get('/', ({ store }) => {
   *     return { counter: store.counter }; // Typed!
   *   });
   * ```
   */
  state<const Key extends string, const Value>(
    key: Key,
    value: Value,
  ): Kito<
    BasePath,
    {
      decorator: Singleton["decorator"];
      store: Prettify<Singleton["store"] & { [K in Key]: Value }>;
      derive: Singleton["derive"];
      resolve: Singleton["resolve"];
    },
    Definitions,
    Routes,
    Ephemeral,
    Volatile
  > {
    this.singletonStore[key] = value;
    return this as any;
  }

  /**
   * Add a decorator to the context (available in all handlers)
   *
   * @example
   * ```typescript
   * const app = new Kito()
   *   .decorate('logger', console)
   *   .get('/', ({ logger }) => {
   *     logger.log('Hello!');
   *     return 'OK';
   *   });
   * ```
   */
  decorate<const Key extends string, const Value>(
    key: Key,
    value: Value,
  ): Kito<
    BasePath,
    {
      decorator: Prettify<Singleton["decorator"] & { [K in Key]: Value }>;
      store: Singleton["store"];
      derive: Singleton["derive"];
      resolve: Singleton["resolve"];
    },
    Definitions,
    Routes,
    Ephemeral,
    Volatile
  > {
    // Store decorator for runtime
    (this.internalServer as any).decorators =
      (this.internalServer as any).decorators || {};
    (this.internalServer as any).decorators[key] = value;
    return this as any;
  }

  /**
   * Derive new context properties from request
   * Runs before validation
   *
   * @example
   * ```typescript
   * const app = new Kito()
   *   .derive(({ request }) => ({
   *     userAgent: request.headers.get('user-agent') ?? 'unknown'
   *   }))
   *   .get('/', ({ userAgent }) => {
   *     return { userAgent }; // Typed as string!
   *   });
   * ```
   */
  derive<const Derived extends Record<string, unknown>>(
    fn: (
      context: Context<
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        Singleton
      >,
    ) => MaybePromise<Derived>,
  ): Kito<
    BasePath,
    {
      decorator: Singleton["decorator"];
      store: Singleton["store"];
      derive: Prettify<Singleton["derive"] & Derived>;
      resolve: Singleton["resolve"];
    },
    Definitions,
    Routes,
    Ephemeral,
    Volatile
  > {
    this.deriveFunctions.push(fn as any);
    return this as any;
  }

  /**
   * Resolve new context properties from request
   * Runs after validation
   *
   * @example
   * ```typescript
   * const app = new Kito()
   *   .resolve(async ({ headers }) => {
   *     const token = headers.authorization;
   *     const user = await validateToken(token);
   *     return { user };
   *   })
   *   .get('/profile', ({ user }) => {
   *     return user; // Typed based on return value!
   *   });
   * ```
   */
  resolve<const Resolved extends Record<string, unknown>>(
    fn: (
      context: Context<
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        Singleton
      >,
    ) => MaybePromise<Resolved>,
  ): Kito<
    BasePath,
    {
      decorator: Singleton["decorator"];
      store: Singleton["store"];
      derive: Singleton["derive"];
      resolve: Prettify<Singleton["resolve"] & Resolved>;
    },
    Definitions,
    Routes,
    Ephemeral,
    Volatile
  > {
    this.resolveFunctions.push(fn as any);
    return this as any;
  }

  // ==========================================================================
  // Route Registration
  // ==========================================================================

  /**
   * Register a GET route
   *
   * @example
   * ```typescript
   * app.get('/users/:id', ({ params }) => {
   *   return { id: params.id }; // params.id is typed as string!
   * });
   * ```
   */
  get<
    const Path extends string,
    const Schema extends InputSchema = {},
    const Response = unknown,
  >(
    path: Path,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "GET",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  /**
   * Register a GET route with schema validation
   */
  get<const Path extends string, const Schema extends InputSchema>(
    path: Path,
    schema: Schema,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "GET",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  // Implementation
  get(
    path: string,
    schemaOrHandler: InputSchema | Function,
    handler?: Function,
  ): any {
    return this.addRoute("GET", path, schemaOrHandler, handler);
  }

  /**
   * Register a POST route
   */
  post<const Path extends string, const Schema extends InputSchema = {}>(
    path: Path,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "POST",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  post<const Path extends string, const Schema extends InputSchema>(
    path: Path,
    schema: Schema,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "POST",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  post(
    path: string,
    schemaOrHandler: InputSchema | Function,
    handler?: Function,
  ): any {
    return this.addRoute("POST", path, schemaOrHandler, handler);
  }

  /**
   * Register a PUT route
   */
  put<const Path extends string, const Schema extends InputSchema = {}>(
    path: Path,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "PUT",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  put<const Path extends string, const Schema extends InputSchema>(
    path: Path,
    schema: Schema,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "PUT",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  put(
    path: string,
    schemaOrHandler: InputSchema | Function,
    handler?: Function,
  ): any {
    return this.addRoute("PUT", path, schemaOrHandler, handler);
  }

  /**
   * Register a DELETE route
   */
  delete<const Path extends string, const Schema extends InputSchema = {}>(
    path: Path,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "DELETE",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  delete<const Path extends string, const Schema extends InputSchema>(
    path: Path,
    schema: Schema,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "DELETE",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  delete(
    path: string,
    schemaOrHandler: InputSchema | Function,
    handler?: Function,
  ): any {
    return this.addRoute("DELETE", path, schemaOrHandler, handler);
  }

  /**
   * Register a PATCH route
   */
  patch<const Path extends string, const Schema extends InputSchema = {}>(
    path: Path,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "PATCH",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  patch<const Path extends string, const Schema extends InputSchema>(
    path: Path,
    schema: Schema,
    handler: InlineHandler<
      MergeSchema<
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        MergeSchema<
          Volatile["schema"],
          MergeSchema<Ephemeral["schema"], EmptyRouteSchema>
        >,
        JoinPath<BasePath, Path>
      >,
      Singleton,
      JoinPath<BasePath, Path>
    >,
  ): Kito<
    BasePath,
    Singleton,
    Definitions,
    MergeRoutes<
      Routes,
      CreateRoute<
        JoinPath<BasePath, Path>,
        "PATCH",
        UnwrapInputSchema<Schema, JoinPath<BasePath, Path>>,
        { 200: Awaited<ReturnType<typeof handler>> }
      >
    >,
    Ephemeral,
    Volatile
  >;

  patch(
    path: string,
    schemaOrHandler: InputSchema | Function,
    handler?: Function,
  ): any {
    return this.addRoute("PATCH", path, schemaOrHandler, handler);
  }

  // ==========================================================================
  // Internal Route Handling
  // ==========================================================================

  private addRoute(
    method: HTTPMethod,
    path: string,
    schemaOrHandler: InputSchema | Function,
    handler?: Function,
  ): this {
    const fullPath = this.config.prefix ? `${this.config.prefix}${path}` : path;

    let finalHandler: Function;
    let schema: InputSchema | undefined;

    if (typeof schemaOrHandler === "function") {
      finalHandler = schemaOrHandler;
    } else {
      schema = schemaOrHandler;
      finalHandler = handler!;
    }

    // Wrap handler to inject derive/resolve/store
    const wrappedHandler = this.wrapHandler(finalHandler);

    // Register with internal server
    const methodLower = method.toLowerCase() as
      | "get"
      | "post"
      | "put"
      | "delete"
      | "patch";

    if (schema) {
      (this.internalServer as any)[methodLower](
        fullPath,
        [schema],
        wrappedHandler,
      );
    } else {
      (this.internalServer as any)[methodLower](fullPath, wrappedHandler);
    }

    return this;
  }

  private wrapHandler(handler: Function): Function {
    const store = this.singletonStore;
    const deriveFns = this.deriveFunctions;
    const resolveFns = this.resolveFunctions;
    const decorators = (this.internalServer as any).decorators || {};

    return async (ctx: any) => {
      // Inject store
      ctx.store = store;

      // Inject decorators
      Object.assign(ctx, decorators);

      // Run derive functions
      for (const derive of deriveFns) {
        const derived = await derive(ctx);
        if (derived && typeof derived === "object") {
          Object.assign(ctx, derived);
        }
      }

      // Run resolve functions
      for (const resolve of resolveFns) {
        const resolved = await resolve(ctx);
        if (resolved && typeof resolved === "object") {
          Object.assign(ctx, resolved);
        }
      }

      // Call the actual handler
      const result = await handler(ctx);

      // If result is returned, send it
      if (result !== undefined) {
        if (typeof result === "object" && result !== null) {
          ctx.res.json(result);
        } else {
          ctx.res.send(String(result));
        }
      }
    };
  }

  // ==========================================================================
  // Plugin System
  // ==========================================================================

  /**
   * Use a plugin or another Kito instance
   *
   * @example
   * ```typescript
   * const authPlugin = new Kito()
   *   .derive(({ headers }) => ({
   *     isAuthenticated: !!headers.authorization
   *   }));
   *
   * const app = new Kito()
   *   .use(authPlugin)
   *   .get('/', ({ isAuthenticated }) => {
   *     return { authenticated: isAuthenticated };
   *   });
   * ```
   */
  use<const Plugin extends AnyKito>(
    plugin: Plugin,
  ): Kito<
    BasePath,
    {
      decorator: Prettify<
        Singleton["decorator"] & Plugin["~Singleton"]["decorator"]
      >;
      store: Prettify<Singleton["store"] & Plugin["~Singleton"]["store"]>;
      derive: Prettify<Singleton["derive"] & Plugin["~Singleton"]["derive"]>;
      resolve: Prettify<Singleton["resolve"] & Plugin["~Singleton"]["resolve"]>;
    },
    Definitions,
    MergeRoutes<Routes, Plugin["~Routes"]>,
    Ephemeral,
    Volatile
  > {
    // Merge stores
    Object.assign(this.singletonStore, (plugin as any).singletonStore);

    // Merge derive functions
    this.deriveFunctions.push(...(plugin as any).deriveFunctions);

    // Merge resolve functions
    this.resolveFunctions.push(...(plugin as any).resolveFunctions);

    // TODO: Merge routes from plugin

    return this as any;
  }

  // ==========================================================================
  // Server Lifecycle
  // ==========================================================================

  /**
   * Start the server
   */
  async listen(port?: number, callback?: () => void): Promise<ServerOptions>;
  async listen(callback?: () => void): Promise<ServerOptions>;
  async listen(
    portOrCallback?: number | (() => void),
    callback?: () => void,
  ): Promise<ServerOptions> {
    if (typeof portOrCallback === "function") {
      return this.internalServer.listen(portOrCallback);
    }
    return this.internalServer.listen(portOrCallback, callback);
  }

  /**
   * Stop the server
   */
  close(): void {
    this.internalServer.close();
  }

  // ==========================================================================
  // Accessor for Routes Type
  // ==========================================================================

  /**
   * Get the type of all routes (for client generation)
   * This is a type-only property
   */
  get _routes(): Routes {
    return {} as Routes;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new type-safe Kito server
 *
 * @example
 * ```typescript
 * import { kito } from 'kitojs';
 *
 * const app = kito()
 *   .state('counter', 0)
 *   .get('/count', ({ store }) => store.counter)
 *   .listen(3000);
 * ```
 */
export function kito<const Prefix extends string = "">(
  config: KitoConfig<Prefix> = {},
): Kito<Prefix> {
  return new Kito(config);
}
