/**
 * Type-safe HTTP client for Kito
 *
 * Creates a proxy-based client that mirrors server routes with full type safety.
 *
 * @example
 * ```typescript
 * import { client } from 'kitojs';
 * import type { App } from './server';
 *
 * const api = client<App>('http://localhost:3000');
 *
 * // All calls are type-safe
 * const { data, error } = await api.users.get();
 * const { data: user } = await api.users({ id: '123' }).get();
 * const { data: created } = await api.users.post({ name: 'John' });
 * ```
 */

import type { Kito } from "../server/kito";
import type { Client } from "./types";

export type { Client };

// ============================================================================
// Constants
// ============================================================================

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "head",
  "options",
] as const;

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a value is a File or Blob
 */
const isFile = (value: unknown): value is File | Blob => {
  return value instanceof Blob;
};

/**
 * Check if an object contains file uploads
 */
const hasFiles = (obj: Record<string, unknown>): boolean => {
  if (!obj || typeof obj !== "object") return false;

  for (const key in obj) {
    const value = obj[key];
    if (isFile(value)) return true;
    if (Array.isArray(value) && value.some(isFile)) return true;
  }

  return false;
};

/**
 * Resolve headers from config (static or function)
 */
const resolveHeaders = async (
  headers: Client.Config["headers"],
): Promise<Record<string, string>> => {
  if (!headers) return {};
  if (typeof headers === "function") {
    return (await headers()) || {};
  }
  return headers;
};

/**
 * Build query string from object
 */
const buildQueryString = (
  query: Record<string, string | number | boolean | string[] | undefined>,
): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        params.append(key, String(v));
      }
    } else if (typeof value === "object") {
      params.append(key, JSON.stringify(value));
    } else {
      params.append(key, String(value));
    }
  }

  const str = params.toString();
  return str ? `?${str}` : "";
};

/**
 * Parse response based on content type
 */
const parseResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type")?.split(";")[0];

  switch (contentType) {
    case "application/json":
      return response.json();

    case "application/octet-stream":
      return response.arrayBuffer();

    case "multipart/form-data": {
      const formData = await response.formData();
      const result: Record<string, unknown> = {};
      formData.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }

    case "text/event-stream":
      // Return the response for streaming
      return response;

    default:
      return response.text();
  }
};

// ============================================================================
// Client Error
// ============================================================================

/**
 * Error thrown when an HTTP request fails
 */
export class ClientError extends Error {
  constructor(
    public status: number,
    public value: unknown,
  ) {
    super(`Request failed with status ${status}`);
    this.name = "ClientError";
  }
}

// ============================================================================
// Proxy Creator
// ============================================================================

/**
 * Create the method caller for HTTP requests
 */
function createMethodCaller(
  domain: string,
  config: Client.Config,
  paths: string[],
  method: string,
) {
  return async (
    bodyOrOptions?: unknown,
    options?: { query?: unknown; headers?: unknown; fetch?: RequestInit },
  ) => {
    const path = "/" + paths.join("/");
    const isGetOrHead = method === "get" || method === "head";

    // For GET/HEAD, first param is options, not body
    const actualOptions = isGetOrHead
      ? (bodyOrOptions as typeof options)
      : options;
    const body = isGetOrHead ? undefined : bodyOrOptions;

    // Build URL with query params
    let url = domain + path;
    if (actualOptions?.query) {
      url += buildQueryString(
        actualOptions.query as Record<string, string | string[]>,
      );
    }

    // Resolve headers
    const configHeaders = await resolveHeaders(config.headers);
    const requestHeaders: Record<string, string> = {
      ...configHeaders,
      ...(actualOptions?.headers as Record<string, string>),
    };

    // Build request init
    let init: RequestInit = {
      method: method.toUpperCase(),
      headers: requestHeaders,
      ...config.fetchOptions,
      ...actualOptions?.fetch,
    };

    // Handle body
    if (body !== undefined && body !== null && !isGetOrHead) {
      if (hasFiles(body as Record<string, unknown>)) {
        // File upload - use FormData
        const formData = new FormData();
        for (const [key, value] of Object.entries(
          body as Record<string, unknown>,
        )) {
          if (Array.isArray(value)) {
            for (const v of value) {
              formData.append(key, v as Blob | string);
            }
          } else {
            formData.append(key, value as Blob | string);
          }
        }
        init.body = formData;
        // Don't set content-type - browser will set it with boundary
      } else if (typeof body === "object") {
        // JSON body
        init.headers = {
          ...init.headers,
          "content-type": "application/json",
        };
        init.body = JSON.stringify(body);
      } else {
        // Plain text body
        init.headers = {
          ...init.headers,
          "content-type": "text/plain",
        };
        init.body = String(body);
      }
    }

    // onRequest hook
    if (config.onRequest) {
      const modified = await config.onRequest(path, init);
      if (modified) {
        init = { ...init, ...modified };
      }
    }

    // Execute request
    const fetcher = config.fetch ?? fetch;
    const response = await fetcher(url, init);

    // Parse response
    let data: unknown = null;
    let error: unknown = null;

    // onResponse hook
    if (config.onResponse) {
      const result = await config.onResponse(response.clone());
      if (result !== undefined && result !== null) {
        data = result;
      }
    }

    // Parse response if not handled by onResponse
    if (data === null) {
      data = await parseResponse(response);
    }

    // Handle error status
    if (response.status >= 300 || response.status < 200) {
      error = {
        status: response.status,
        value: data,
      };
      data = null;
    }

    return {
      data,
      error,
      status: response.status,
      response,
      headers: response.headers,
    };
  };
}

/**
 * Create a recursive proxy for path building
 */
function createProxy(
  domain: string,
  config: Client.Config,
  paths: string[] = [],
): unknown {
  return new Proxy(() => {}, {
    get(_, prop: string): unknown {
      // If it's an HTTP method, return the caller
      if (HTTP_METHODS.includes(prop as (typeof HTTP_METHODS)[number])) {
        return createMethodCaller(domain, config, paths, prop);
      }

      // Handle 'index' specially (for root paths)
      if (prop === "index") {
        return createProxy(domain, config, paths);
      }

      // Otherwise, accumulate the path segment
      return createProxy(domain, config, [...paths, prop]);
    },

    apply(_, __, args: unknown[]): unknown {
      const [params] = args;

      // Function call = path parameter substitution
      if (params && typeof params === "object") {
        // Get the parameter value(s)
        const values = Object.values(params);
        if (values.length > 0) {
          // Add parameter value to path
          return createProxy(domain, config, [...paths, String(values[0])]);
        }
      }

      return createProxy(domain, config, paths);
    },
  });
}

// ============================================================================
// Main Client Factory
// ============================================================================

/**
 * Create a type-safe HTTP client for a Kito server
 *
 * @param domain - The server URL (e.g., 'http://localhost:3000' or 'localhost:3000')
 * @param config - Optional client configuration
 * @returns A type-safe client proxy
 *
 * @example Basic usage
 * ```typescript
 * import { client } from 'kitojs';
 * import type { App } from './server';
 *
 * const api = client<App>('http://localhost:3000');
 *
 * // GET request
 * const { data, error } = await api.users.get();
 *
 * // GET with path parameter
 * const { data: user } = await api.users({ id: '123' }).get();
 *
 * // POST with body
 * const { data: created } = await api.users.post({
 *   name: 'John',
 *   email: 'john@example.com'
 * });
 *
 * // GET with query params
 * const { data: filtered } = await api.users.get({
 *   query: { limit: 10, offset: 0 }
 * });
 * ```
 *
 * @example With configuration
 * ```typescript
 * const api = client<App>('http://localhost:3000', {
 *   headers: {
 *     'Authorization': 'Bearer token'
 *   },
 *   onRequest: (path, init) => {
 *     console.log(`Requesting ${path}`);
 *     return init;
 *   },
 *   onResponse: (response) => {
 *     console.log(`Response: ${response.status}`);
 *   }
 * });
 * ```
 *
 * @example With dynamic headers
 * ```typescript
 * const api = client<App>('http://localhost:3000', {
 *   headers: async () => ({
 *     'Authorization': `Bearer ${await getToken()}`
 *   })
 * });
 * ```
 */
export function client<App extends Kito<any, any, any, any, any, any>>(
  domain: string,
  config: Client.Config = {},
): Client.Create<App> {
  // Normalize domain
  if (!domain.includes("://")) {
    // Add protocol based on hostname
    const isLocal = LOCAL_HOSTS.some((host) => domain.includes(host));
    domain = (isLocal ? "http://" : "https://") + domain;
  }

  // Remove trailing slash
  if (domain.endsWith("/")) {
    domain = domain.slice(0, -1);
  }

  return createProxy(domain, config) as Client.Create<App>;
}

// Re-export types (already exported via `export type { Client }` above)
