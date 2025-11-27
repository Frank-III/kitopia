/**
 * Core utility types for Kito's type-safe infrastructure
 * Inspired by Elysia's type system
 */

// ============================================================================
// Basic Utility Types
// ============================================================================

/**
 * Check if two types are exactly equal
 */
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T,
>() => T extends Y ? 1 : 2
  ? true
  : false;

/**
 * Check if a type is never
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Check if a type is any
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Check if a type is unknown
 */
export type IsUnknown<T> = [unknown] extends [T]
  ? IsAny<T> extends true
    ? false
    : true
  : false;

/**
 * Prettify an object type for better IDE display
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Maybe a promise
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Maybe an array
 */
export type MaybeArray<T> = T | T[];

/**
 * Get values of an object
 */
export type ObjectValues<T extends object> = T[keyof T];

// ============================================================================
// Path Parameter Extraction Types
// ============================================================================

/**
 * Check if a path segment is a parameter (starts with :)
 */
type IsPathParameter<Part extends string> = Part extends `:${infer Parameter}`
  ? Parameter extends `${infer Name}?`
    ? never // Optional params handled separately
    : Parameter
  : Part extends "*"
    ? "*"
    : never;

/**
 * Check if a path segment is an optional parameter (ends with ?)
 */
type IsOptionalPathParameter<Part extends string> =
  Part extends `:${infer Parameter}`
    ? Parameter extends `${infer OptName}?`
      ? OptName
      : never
    : never;

/**
 * Extract all path parameters from a path string
 * @example GetPathParameter<'/users/:id/posts/:postId'> = 'id' | 'postId'
 */
export type GetPathParameter<Path extends string> =
  Path extends `${infer A}/${infer B}`
    ? IsPathParameter<A> | GetPathParameter<B>
    : IsPathParameter<Path>;

/**
 * Extract all optional path parameters from a path string
 */
export type GetOptionalPathParameter<Path extends string> =
  Path extends `${infer A}/${infer B}`
    ? IsOptionalPathParameter<A> | GetOptionalPathParameter<B>
    : IsOptionalPathParameter<Path>;

/**
 * Resolve path parameters to an object type
 * @example ResolvePath<'/users/:id'> = { id: string }
 * @example ResolvePath<'/users/:id?'> = { id?: string }
 */
export type ResolvePath<Path extends string> = Path extends ""
  ? {}
  : Prettify<
      {
        [K in GetPathParameter<Path>]: string;
      } & {
        [K in GetOptionalPathParameter<Path>]?: string;
      }
    >;

/**
 * Check if a path contains parameters
 * @internal Used for conditional type checks
 */
export type PathParameterLike = `${string}/:${string}` | `${string}/*${string}`;

/**
 * Join two paths together
 */
export type JoinPath<A extends string, B extends string> = A extends ""
  ? B
  : B extends ""
    ? A
    : B extends `/${string}`
      ? `${A}${B}`
      : `${A}/${B}`;

// ============================================================================
// Object Manipulation Types
// ============================================================================

/**
 * Deep merge two objects, with B taking precedence
 */
export type Reconcile<
  A extends object,
  B extends object,
  Override extends boolean = false,
> = Override extends true
  ? Prettify<Omit<A, keyof B> & B>
  : Prettify<A & Omit<B, keyof A>>;

/**
 * Make all properties optional that can be never
 */
export type NeverKey<T> = {
  [K in keyof T]?: never;
} & {};

/**
 * Intersect two types if both are objects
 */
export type IntersectIfObject<A, B> = A extends Record<string, unknown>
  ? B extends Record<string, unknown>
    ? A & B
    : A
  : B extends Record<string, unknown>
    ? B
    : A;

// ============================================================================
// Function Types
// ============================================================================

/**
 * Extract return type from a function or return the type itself
 */
export type UnwrapReturnType<T> = T extends (...args: unknown[]) => infer R
  ? Awaited<R>
  : T;

/**
 * Extract return type from array of functions
 */
export type UnwrapReturnTypeArray<T extends unknown[], Carry = {}> = T extends [
  infer First,
  ...infer Rest,
]
  ? Rest extends unknown[]
    ? UnwrapReturnTypeArray<Rest, Carry & UnwrapReturnType<First>>
    : Carry
  : Carry;

// ============================================================================
// Union/Intersection Utilities
// ============================================================================

/**
 * Convert union to intersection
 */
export type UnionToIntersection<U> = (
  U extends unknown
    ? (arg: U) => 0
    : never
) extends (arg: infer I) => 0
  ? I
  : never;

/**
 * Get the last type in a union
 */
type LastOf<T> = UnionToIntersection<
  T extends unknown ? () => T : never
> extends () => infer R
  ? R
  : never;

/**
 * Convert union to tuple
 */
export type UnionToTuple<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false,
> = true extends N ? [] : [...UnionToTuple<Exclude<T, L>>, L];

// ============================================================================
// Conditional Types
// ============================================================================

/**
 * Conditional type that returns A if T is true, B otherwise
 */
export type If<T extends boolean, A, B> = T extends true ? A : B;

/**
 * Or operation on two booleans
 */
export type Or<T1 extends boolean, T2 extends boolean> = T1 extends true
  ? true
  : T2 extends true
    ? true
    : false;

/**
 * And operation on two booleans
 */
export type And<T1 extends boolean, T2 extends boolean> = T1 extends true
  ? T2 extends true
    ? true
    : false
  : false;

// ============================================================================
// Response Status Types
// ============================================================================

/**
 * Common HTTP status codes mapped to names
 */
export interface StatusMap {
  Continue: 100;
  "Switching Protocols": 101;
  Processing: 102;
  "Early Hints": 103;
  OK: 200;
  Created: 201;
  Accepted: 202;
  "Non-Authoritative Information": 203;
  "No Content": 204;
  "Reset Content": 205;
  "Partial Content": 206;
  "Multi-Status": 207;
  "Already Reported": 208;
  "IM Used": 226;
  "Multiple Choices": 300;
  "Moved Permanently": 301;
  Found: 302;
  "See Other": 303;
  "Not Modified": 304;
  "Temporary Redirect": 307;
  "Permanent Redirect": 308;
  "Bad Request": 400;
  Unauthorized: 401;
  "Payment Required": 402;
  Forbidden: 403;
  "Not Found": 404;
  "Method Not Allowed": 405;
  "Not Acceptable": 406;
  "Proxy Authentication Required": 407;
  "Request Timeout": 408;
  Conflict: 409;
  Gone: 410;
  "Length Required": 411;
  "Precondition Failed": 412;
  "Payload Too Large": 413;
  "URI Too Long": 414;
  "Unsupported Media Type": 415;
  "Range Not Satisfiable": 416;
  "Expectation Failed": 417;
  "I'm a Teapot": 418;
  "Misdirected Request": 421;
  "Unprocessable Content": 422;
  Locked: 423;
  "Failed Dependency": 424;
  "Too Early": 425;
  "Upgrade Required": 426;
  "Precondition Required": 428;
  "Too Many Requests": 429;
  "Request Header Fields Too Large": 431;
  "Unavailable For Legal Reasons": 451;
  "Internal Server Error": 500;
  "Not Implemented": 501;
  "Bad Gateway": 502;
  "Service Unavailable": 503;
  "Gateway Timeout": 504;
  "HTTP Version Not Supported": 505;
  "Variant Also Negotiates": 506;
  "Insufficient Storage": 507;
  "Loop Detected": 508;
  "Not Extended": 510;
  "Network Authentication Required": 511;
}

/**
 * Inverted status map (code -> name)
 */
export type InvertedStatusMap = {
  [K in keyof StatusMap as StatusMap[K]]: K;
};

/**
 * Union response status types
 */
export type UnionResponseStatus<A, B> = {} extends A
  ? B
  : {} extends B
    ? A
    : Prettify<{
        [K in keyof A | keyof B]: K extends keyof A
          ? K extends keyof B
            ? A[K] | B[K]
            : A[K]
          : K extends keyof B
            ? B[K]
            : never;
      }>;
