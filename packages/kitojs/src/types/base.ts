/**
 * Base interfaces for Kito's type-safe architecture
 * These define the shape of data stored in generic parameters
 */

import type { Prettify, MaybePromise, ResolvePath } from "./utils";

// ============================================================================
// Schema Types (compatible with existing Kito schema system)
// ============================================================================

/**
 * Base schema type interface
 */
export interface SchemaType {
  _type: unknown;
  _optional: boolean;
  _default?: unknown;
}

/**
 * Infer the TypeScript type from a schema
 */
export type InferType<T extends SchemaType> = T extends { _default: infer D }
  ? D
  : T extends { _optional: true }
    ? T["_type"] | undefined
    : T["_type"];

/**
 * Input schema definition for routes
 */
export interface InputSchema {
  body?: SchemaType;
  headers?: SchemaType;
  query?: SchemaType;
  params?: SchemaType;
  cookie?: SchemaType;
  response?: ResponseSchema;
}

/**
 * Response schema by status code
 */
export interface ResponseSchema {
  [statusCode: number]: unknown;
}

// ============================================================================
// Route Schema Types
// ============================================================================

/**
 * Resolved/unwrapped route schema
 */
export interface RouteSchema {
  body: unknown;
  headers: unknown;
  query: unknown;
  params: unknown;
  cookie: unknown;
  response: unknown;
}

/**
 * Empty route schema for defaults
 */
export interface EmptyRouteSchema {
  body: unknown;
  headers: unknown;
  query: unknown;
  params: {};
  cookie: unknown;
  response: unknown;
}

/**
 * Unknown route schema with generic params
 */
export interface UnknownRouteSchema<
  Params = { [name: string]: string | undefined },
> {
  body: unknown;
  headers: { [name: string]: string | undefined };
  query: { [name: string]: string | undefined };
  params: Params;
  cookie: {};
  response: unknown;
}

// ============================================================================
// Singleton Base - Global State
// ============================================================================

/**
 * Base interface for singleton (global) state
 */
export interface SingletonBase {
  /**
   * Decorators added via .decorate()
   */
  decorator: Record<string, unknown>;
  /**
   * Global store via .state()
   */
  store: Record<string, unknown>;
  /**
   * Derived values via .derive()
   */
  derive: Record<string, unknown>;
  /**
   * Resolved values via .resolve()
   */
  resolve: Record<string, unknown>;
}

/**
 * Default empty singleton
 */
export type EmptySingleton = {
  decorator: {};
  store: {};
  derive: {};
  resolve: {};
};

// ============================================================================
// Definition Base - Types & Errors
// ============================================================================

/**
 * Base interface for type definitions
 */
export interface DefinitionBase {
  /**
   * Registered schema types
   */
  schemas: Record<string, SchemaType>;
  /**
   * Registered error types
   */
  error: Record<string, Error>;
}

/**
 * Default empty definitions
 */
export type EmptyDefinitions = {
  schemas: {};
  error: {};
};

// ============================================================================
// Metadata Base - Schema Inheritance & Macros
// ============================================================================

/**
 * Base interface for metadata
 */
export interface MetadataBase {
  /**
   * Schema inherited from guards
   */
  schema: RouteSchema;
  /**
   * Macro definitions
   */
  macro: Record<string, unknown>;
  /**
   * Custom parsers
   */
  parser: Record<string, unknown>;
  /**
   * Response type accumulation
   */
  response: Record<number, unknown>;
}

/**
 * Default empty metadata
 */
export type EmptyMetadata = {
  schema: EmptyRouteSchema;
  macro: {};
  parser: {};
  response: {};
};

// ============================================================================
// Ephemeral Types - Scoped State
// ============================================================================

/**
 * Ephemeral (scoped) state - for plugins
 */
export interface EphemeralType {
  derive: Record<string, unknown>;
  resolve: Record<string, unknown>;
  schema: RouteSchema;
  response: Record<number, unknown>;
}

/**
 * Default empty ephemeral
 */
export type EmptyEphemeral = {
  derive: {};
  resolve: {};
  schema: EmptyRouteSchema;
  response: {};
};

// ============================================================================
// Volatile Types - Local State
// ============================================================================

/**
 * Volatile (local) state - for single routes
 */
export interface VolatileType {
  derive: Record<string, unknown>;
  resolve: Record<string, unknown>;
  schema: RouteSchema;
  response: Record<number, unknown>;
}

/**
 * Default empty volatile
 */
export type EmptyVolatile = {
  derive: {};
  resolve: {};
  schema: EmptyRouteSchema;
  response: {};
};

// ============================================================================
// Route Base - For Client Generation
// ============================================================================

/**
 * Base type for accumulated routes (Eden-like)
 */
export type RouteBase = Record<string, unknown>;

/**
 * HTTP Methods
 */
export type HTTPMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS"
  | "TRACE"
  | "ALL";

// ============================================================================
// Schema Unwrapping Types
// ============================================================================

/**
 * Unwrap a schema type to its TypeScript type
 */
export type UnwrapSchema<T> = T extends SchemaType ? InferType<T> : unknown;

/**
 * Unwrap an input schema to a route schema
 */
export type UnwrapInputSchema<
  Schema extends InputSchema,
  Path extends string = "",
> = {
  body: UnwrapSchema<Schema["body"]>;
  headers: UnwrapSchema<Schema["headers"]>;
  query: UnwrapSchema<Schema["query"]>;
  params: Schema["params"] extends SchemaType
    ? UnwrapSchema<Schema["params"]>
    : ResolvePath<Path>;
  cookie: UnwrapSchema<Schema["cookie"]>;
  response: Schema["response"] extends ResponseSchema
    ? Schema["response"]
    : unknown;
};

// ============================================================================
// Schema Merging Types
// ============================================================================

/**
 * Merge two route schemas, with B taking precedence
 */
export type MergeSchema<
  A extends RouteSchema | InputSchema,
  B extends RouteSchema | InputSchema,
  Path extends string = "",
> = {
  body: unknown extends B["body"]
    ? A extends { body: infer AB }
      ? AB
      : unknown
    : B["body"];
  headers: unknown extends B["headers"]
    ? A extends { headers: infer AH }
      ? AH
      : unknown
    : B["headers"];
  query: unknown extends B["query"]
    ? A extends { query: infer AQ }
      ? AQ
      : unknown
    : B["query"];
  params: {} extends (B extends { params: infer BP } ? BP : {})
    ? {} extends (A extends { params: infer AP } ? AP : {})
      ? ResolvePath<Path>
      : A extends { params: infer AP }
        ? AP
        : ResolvePath<Path>
    : B extends { params: infer BP }
      ? BP
      : ResolvePath<Path>;
  cookie: unknown extends B["cookie"]
    ? A extends { cookie: infer AC }
      ? AC
      : unknown
    : B["cookie"];
  response: unknown extends B["response"]
    ? A extends { response: infer AR }
      ? AR
      : unknown
    : B["response"];
};

// ============================================================================
// Possible Response Types
// ============================================================================

/**
 * Possible responses by status code
 */
export interface PossibleResponse {
  [status: number]: unknown;
}

// ============================================================================
// Life Cycle Types
// ============================================================================

/**
 * Life cycle scope type
 */
export type LifeCycleType = "global" | "local" | "scoped";

// ============================================================================
// Context Types
// ============================================================================

/**
 * Base context interface available in all handlers
 */
export interface BaseContext {
  /**
   * Raw request object
   */
  request: Request;
  /**
   * Set response properties
   */
  set: {
    headers: Record<string, string | number>;
    status?: number;
    redirect?: string;
  };
  /**
   * Request path
   */
  path: string;
  /**
   * Route pattern
   */
  route: string;
}

/**
 * Full context with all route-specific types
 */
export type Context<
  Route extends RouteSchema = EmptyRouteSchema,
  Singleton extends SingletonBase = EmptySingleton,
  Path extends string | undefined = undefined,
> = Prettify<
  BaseContext & {
    body: Route["body"];
    query: Route["query"] extends undefined
      ? Record<string, string | undefined>
      : Route["query"];
    params: Route["params"] extends undefined
      ? Path extends `${string}/:${string}`
        ? ResolvePath<Path & string>
        : Record<string, string>
      : Route["params"];
    headers: Route["headers"] extends undefined
      ? Record<string, string | undefined>
      : Route["headers"];
    cookie: Route["cookie"] extends undefined
      ? Record<string, unknown>
      : Route["cookie"];
    store: Singleton["store"];
  } & Singleton["decorator"] &
    Singleton["derive"] &
    Singleton["resolve"]
>;

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Route handler function type
 */
export type Handler<
  Route extends RouteSchema = EmptyRouteSchema,
  Singleton extends SingletonBase = EmptySingleton,
  Path extends string | undefined = undefined,
> = (
  context: Context<Route, Singleton, Path>,
) => MaybePromise<
  Route["response"] extends { [K: number]: infer R } ? R : unknown
>;

/**
 * Inline handler that can return any value
 */
export type InlineHandler<
  Route extends RouteSchema = EmptyRouteSchema,
  Singleton extends SingletonBase = EmptySingleton,
  Path extends string | undefined = undefined,
> = (context: Context<Route, Singleton, Path>) => MaybePromise<unknown>;

/**
 * Optional handler (for beforeHandle, etc.) that can return void
 */
export type OptionalHandler<
  Route extends RouteSchema = EmptyRouteSchema,
  Singleton extends SingletonBase = EmptySingleton,
  Path extends string | undefined = undefined,
> = (context: Context<Route, Singleton, Path>) => MaybePromise<unknown | void>;

/**
 * Transform handler that returns void
 */
export type TransformHandler<
  Route extends RouteSchema = EmptyRouteSchema,
  Singleton extends SingletonBase = EmptySingleton,
  Path extends string | undefined = undefined,
> = (context: Context<Route, Singleton, Path>) => MaybePromise<void>;

/**
 * Derive handler that returns new context properties
 */
export type DeriveHandler<
  Route extends RouteSchema = EmptyRouteSchema,
  Singleton extends SingletonBase = EmptySingleton,
  Derived extends Record<string, unknown> = Record<string, unknown>,
> = (context: Context<Route, Singleton>) => MaybePromise<Derived>;

/**
 * Resolve handler that returns new context properties
 */
export type ResolveHandler<
  Route extends RouteSchema = EmptyRouteSchema,
  Singleton extends SingletonBase = EmptySingleton,
  Resolved extends Record<string, unknown> = Record<string, unknown>,
> = (context: Context<Route, Singleton>) => MaybePromise<Resolved>;
