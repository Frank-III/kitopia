/**
 * Route accumulation types for Eden-like client generation
 */

import type { Prettify, ResolvePath, IsNever } from "./utils";
import type {
  RouteSchema,
  HTTPMethod,
  PossibleResponse,
  InputSchema,
} from "./base";

// ============================================================================
// Route Path Types
// ============================================================================

/**
 * Create a nested route object from a path
 * @example CreateRoute<'/users/:id', 'GET', Schema> creates:
 * { users: { ':id': { get: { ... } } } }
 */
export type CreateRoute<
  Path extends string,
  Method extends HTTPMethod,
  Schema extends RouteSchema,
  Response extends PossibleResponse = {},
> = CreateRoutePath<
  Path,
  {
    [M in Method as Lowercase<M>]: {
      body: Schema["body"];
      params: IsNever<keyof Schema["params"]> extends true
        ? ResolvePath<Path>
        : Schema["params"];
      query: Schema["query"];
      headers: Schema["headers"];
      response: Prettify<Response>;
    };
  }
>;

/**
 * Recursively create nested path object
 */
type CreateRoutePath<
  Path extends string,
  Property extends Record<string, unknown>,
> = Path extends `/${infer Rest}`
  ? CreateRoutePath<Rest, Property>
  : Path extends `${infer Segment}/${infer Rest}`
    ? { [K in Segment]: CreateRoutePath<Rest, Property> }
    : Path extends ""
      ? Property
      : { [K in Path]: Property };

// ============================================================================
// Route Definition for Internal Use
// ============================================================================

/**
 * Internal route definition
 */
export interface InternalRoute {
  method: HTTPMethod;
  path: string;
  handler: unknown;
  hooks: unknown;
  schema?: InputSchema;
}

// ============================================================================
// Route Merging Types
// ============================================================================

/**
 * Deep merge two route objects
 */
export type MergeRoutes<A, B> = A extends Record<string, unknown>
  ? B extends Record<string, unknown>
    ? {
        [K in keyof A | keyof B]: K extends keyof A
          ? K extends keyof B
            ? MergeRoutes<A[K], B[K]>
            : A[K]
          : K extends keyof B
            ? B[K]
            : never;
      }
    : B
  : B;

// ============================================================================
// Route Schema Extraction
// ============================================================================

/**
 * Extract response type from route handler return
 */
export type ExtractResponse<T> = T extends (...args: unknown[]) => infer R
  ? Awaited<R>
  : T;

/**
 * Create response schema from handler return type
 */
export type CreateResponseSchema<T, DefaultStatus extends number = 200> = {
  [K in DefaultStatus]: ExtractResponse<T>;
};

// ============================================================================
// Eden-like Route Access Types
// ============================================================================

/**
 * Route accessor type for treaty-like client
 */
export type RouteAccessor<R> = R extends Record<string, unknown>
  ? {
      [K in keyof R]: K extends `:${string}`
        ? (param: string) => RouteAccessor<R[K]>
        : R[K] extends { GET: infer G }
          ? RouteAccessor<R[K]> & { get: RouteMethod<G> }
          : R[K] extends { POST: infer P }
            ? RouteAccessor<R[K]> & { post: RouteMethod<P> }
            : R[K] extends { PUT: infer U }
              ? RouteAccessor<R[K]> & { put: RouteMethod<U> }
              : R[K] extends { DELETE: infer D }
                ? RouteAccessor<R[K]> & { delete: RouteMethod<D> }
                : R[K] extends { PATCH: infer PA }
                  ? RouteAccessor<R[K]> & { patch: RouteMethod<PA> }
                  : RouteAccessor<R[K]>;
    }
  : R;

/**
 * Route method signature
 */
export type RouteMethod<T> = T extends {
  body: infer Body;
  params: infer Params;
  query: infer Query;
  headers: infer Headers;
  response: infer Response;
}
  ? (options?: {
      body?: Body;
      params?: Params;
      query?: Query;
      headers?: Headers;
    }) => Promise<{
      data: Response extends { 200: infer R } ? R : Response;
      status: number;
      headers: Headers;
    }>
  : never;

// ============================================================================
// Add Prefix to Routes
// ============================================================================

/**
 * Add a prefix to all routes
 */
export type AddPrefix<Prefix extends string, R> = Prefix extends ""
  ? R
  : R extends Record<string, unknown>
    ? CreateRoutePath<Prefix, R>
    : R;

// ============================================================================
// Route Type Guards
// ============================================================================

/**
 * Check if a route exists at a path
 */
export type HasRoute<
  Routes,
  Path extends string,
  Method extends HTTPMethod,
> = GetRouteAt<Routes, Path> extends { [M in Method]: unknown } ? true : false;

/**
 * Get route at a specific path
 */
type GetRouteAt<Routes, Path extends string> = Path extends `/${infer Rest}`
  ? GetRouteAt<Routes, Rest>
  : Path extends `${infer Segment}/${infer Rest}`
    ? Routes extends { [K in Segment]: infer R }
      ? GetRouteAt<R, Rest>
      : never
    : Routes extends { [K in Path]: infer R }
      ? R
      : never;
