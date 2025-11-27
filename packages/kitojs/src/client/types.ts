/**
 * Type-safe HTTP client types for Kito
 *
 * Similar to Elysia's Eden Treaty, this provides compile-time type safety
 * for API clients that mirrors the server's route definitions.
 */

import type { Kito } from "../server/kito";
import type { Prettify, IsNever } from "../types/utils";

// ============================================================================
// Utility Types
// ============================================================================

type MaybePromise<T> = T | Promise<T>;

/**
 * Success status codes (200-299)
 */
type SuccessStatusCode = 200 | 201 | 202 | 203 | 204 | 205 | 206;

/**
 * Extract success response from response map
 */
type ExtractSuccessResponse<Res extends Record<number, unknown>> = Res[Extract<
  keyof Res,
  SuccessStatusCode
>];

/**
 * Extract error response from response map
 */
type ExtractErrorResponse<Res extends Record<number, unknown>> = Exclude<
  keyof Res,
  SuccessStatusCode
> extends never
  ? { status: number; value: unknown }
  : {
      [Status in Exclude<keyof Res, SuccessStatusCode>]: {
        status: Status;
        value: Res[Status];
      };
    }[Exclude<keyof Res, SuccessStatusCode>];

// ============================================================================
// Client Namespace
// ============================================================================

export namespace Client {
  // ==========================================================================
  // Configuration Types
  // ==========================================================================

  /**
   * Client configuration options
   */
  export interface Config {
    /**
     * Custom fetch implementation
     */
    fetch?: typeof fetch;

    /**
     * Default headers to send with every request
     */
    headers?:
      | Record<string, string>
      | (() => Record<string, string> | Promise<Record<string, string>>);

    /**
     * Hook called before each request
     */
    onRequest?: (
      path: string,
      init: RequestInit,
    ) => MaybePromise<RequestInit | void>;

    /**
     * Hook called after each response
     */
    onResponse?: (response: globalThis.Response) => MaybePromise<unknown>;

    /**
     * Base fetch options
     */
    fetchOptions?: Omit<RequestInit, "method" | "body" | "headers">;
  }

  /**
   * Per-request options
   */
  export interface RequestOptions<Query = unknown, Headers = unknown> {
    query?: Query;
    headers?: Headers;
    fetch?: RequestInit;
  }

  // ==========================================================================
  // Response Types
  // ==========================================================================

  /**
   * Successful response type
   */
  export interface SuccessResult<Data> {
    data: Data;
    error: null;
    status: number;
    response: globalThis.Response;
    headers: globalThis.Headers;
  }

  /**
   * Error response type
   */
  export interface ErrorResult<Err> {
    data: null;
    error: Err;
    status: number;
    response: globalThis.Response;
    headers: globalThis.Headers;
  }

  /**
   * Union response type for type-safe error handling
   */
  export type Result<Res extends Record<number, unknown>> =
    | SuccessResult<ExtractSuccessResponse<Res>>
    | ErrorResult<ExtractErrorResponse<Res>>;

  // ==========================================================================
  // Route Method Types
  // ==========================================================================

  /**
   * Create a method signature for GET/HEAD requests (no body)
   */
  type CreateGetMethod<Route extends RouteDefinition> = (
    options?: Prettify<{
      query?: Route["query"];
      headers?: Route["headers"];
      fetch?: RequestInit;
    }>,
  ) => Promise<Result<Route["response"]>>;

  /**
   * Create a method signature for POST/PUT/PATCH/DELETE requests (with body)
   */
  type CreateBodyMethod<Route extends RouteDefinition> =
    {} extends Route["body"]
      ? (
          body?: Route["body"],
          options?: Prettify<{
            query?: Route["query"];
            headers?: Route["headers"];
            fetch?: RequestInit;
          }>,
        ) => Promise<Result<Route["response"]>>
      : (
          body: Route["body"],
          options?: Prettify<{
            query?: Route["query"];
            headers?: Route["headers"];
            fetch?: RequestInit;
          }>,
        ) => Promise<Result<Route["response"]>>;

  /**
   * Route definition structure
   */
  interface RouteDefinition {
    body: unknown;
    params: unknown;
    query: unknown;
    headers: unknown;
    response: Record<number, unknown>;
  }

  /**
   * Extract options from route definition
   */
  type RouteOptions<Route extends RouteDefinition> = {
    body: Route["body"];
    query: Route["query"];
    headers: Route["headers"];
  };

  // ==========================================================================
  // Sign Types - Convert Routes to Client Methods
  // ==========================================================================

  /**
   * Sign a route object, converting HTTP methods to callable functions
   * Does NOT exclude path parameters - those are handled by CreateParams
   */
  export type Sign<Route extends Record<string, any>> = {
    [K in keyof Route as K extends `:${string}` ? never : K]: K extends
      | "get"
      | "head"
      ? Route[K] extends RouteDefinition
        ? CreateGetMethod<Route[K]>
        : Route[K] extends Record<string, any>
          ? Sign<Route[K]> & ParamHandler<Route[K]>
          : never
      : K extends "post" | "put" | "patch" | "delete" | "options"
        ? Route[K] extends RouteDefinition
          ? CreateBodyMethod<Route[K]>
          : Route[K] extends Record<string, any>
            ? Sign<Route[K]> & ParamHandler<Route[K]>
            : never
        : Route[K] extends RouteDefinition
          ? never
          : Route[K] extends Record<string, any>
            ? Sign<Route[K]> & ParamHandler<Route[K]>
            : never;
  };

  // ==========================================================================
  // Path Parameter Types
  // ==========================================================================

  /**
   * Extract parameter name from path segment
   * `:id` -> `id`
   * `:id?` -> `id` (optional)
   */
  type ExtractParamName<T extends string> = T extends `:${infer Name}?`
    ? Name
    : T extends `:${infer Name}`
      ? Name
      : never;

  /**
   * Create parameter object type from path parameters
   */
  type CreateParamObject<Keys extends string> = {
    [K in ExtractParamName<Keys>]: string | number;
  };

  /**
   * Handle path parameters at any nesting level
   */
  type ParamHandler<Route extends Record<string, any>> = Extract<
    keyof Route,
    `:${string}`
  > extends infer Path extends string
    ? IsNever<Path> extends true
      ? {}
      : (
          params: CreateParamObject<Path>,
        ) => Sign<Route[Path]> & ParamHandler<Route[Path]>
    : {};

  /**
   * Handle path parameters - creates a function that accepts params and returns nested routes
   */
  export type CreateParams<Route extends Record<string, any>> = Extract<
    keyof Route,
    `:${string}`
  > extends infer Path extends string
    ? IsNever<Path> extends true
      ? {}
      : (
          params: CreateParamObject<Path>,
        ) => Sign<Route[Path]> & CreateParams<Route[Path]>
    : {};

  // ==========================================================================
  // Main Client Type
  // ==========================================================================

  /**
   * Create a type-safe client from a Kito app type
   *
   * @example
   * ```typescript
   * import { client } from 'kitojs';
   * import type { App } from './server';
   *
   * const api = client<App>('http://localhost:3000');
   *
   * // Type-safe API calls
   * const users = await api.users.get();
   * const user = await api.users({ id: '123' }).get();
   * ```
   */
  export type Create<App extends Kito<any, any, any, any, any, any>> =
    App extends { "~Routes": infer Schema extends Record<string, any> }
      ? Prettify<Sign<Schema>> & CreateParams<Schema>
      : "Please ensure your Kito app has routes defined";

  // ==========================================================================
  // Helper Types for Users
  // ==========================================================================

  /**
   * Extract the data type from a client response
   *
   * @example
   * ```typescript
   * type UserData = Client.InferData<typeof api.users.get>;
   * ```
   */
  export type InferData<T extends (...args: any[]) => Promise<Result<any>>> =
    NonNullable<Awaited<ReturnType<T>>["data"]>;

  /**
   * Extract the error type from a client response
   *
   * @example
   * ```typescript
   * type UserError = Client.InferError<typeof api.users.get>;
   * ```
   */
  export type InferError<T extends (...args: any[]) => Promise<Result<any>>> =
    NonNullable<Awaited<ReturnType<T>>["error"]>;

  /**
   * Extract the full response type from a client method
   */
  export type InferResult<T extends (...args: any[]) => Promise<Result<any>>> =
    Awaited<ReturnType<T>>;

  // Keep backward compat alias
  export type InferResponse<
    T extends (...args: any[]) => Promise<Result<any>>,
  > = InferResult<T>;

  // Also export Result as Response for convenience (aliased)
  export type Response<Res extends Record<number, unknown>> = Result<Res>;
}
