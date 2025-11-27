/**
 * Type Safety Example
 *
 * This file demonstrates the Elysia-level type safety in the new Kito server.
 * All type inference happens at compile-time without affecting runtime performance.
 */

import { Kito, kito } from "../../packages/kitojs/src/server/kito";

// ============================================================================
// Example 1: Path Parameter Extraction
// ============================================================================

const app1 = kito()
  .get("/users/:id", ({ params }) => {
    // params.id is automatically typed as string!
    const userId: string = params.id;
    return { userId };
  })
  .get("/users/:userId/posts/:postId", ({ params }) => {
    // Both params are typed!
    const userId: string = params.userId;
    const postId: string = params.postId;
    return { userId, postId };
  });

// ============================================================================
// Example 2: Global State with .state()
// ============================================================================

const app2 = kito()
  .state("counter", 0)
  .state("config", { debug: true, version: "1.0.0" })
  .get("/", ({ store }) => {
    // store.counter is typed as number
    // store.config is typed as { debug: boolean, version: string }
    const count: number = store.counter;
    const version: string = store.config.version;
    return { count, version };
  });

// ============================================================================
// Example 3: Derived Context with .derive()
// ============================================================================

const app3 = kito()
  .derive(({ request }) => ({
    userAgent: request.headers.get("user-agent") ?? "unknown",
    timestamp: Date.now(),
  }))
  .get("/info", ({ userAgent, timestamp }) => {
    // userAgent is typed as string
    // timestamp is typed as number
    return { userAgent, timestamp };
  });

// ============================================================================
// Example 4: Chained derive() calls
// ============================================================================

const app4 = kito()
  .state("users", new Map<string, { name: string }>())
  .derive(({ request }) => ({
    authToken: request.headers.get("authorization"),
  }))
  .derive(({ authToken }) => ({
    // authToken from previous derive is available and typed!
    isAuthenticated: authToken !== null,
  }))
  .get("/profile", ({ isAuthenticated, store }) => {
    // isAuthenticated is typed as boolean
    // store.users is typed as Map<string, { name: string }>
    return { isAuthenticated };
  });

// ============================================================================
// Example 5: Resolve for async operations
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
}

const app5 = kito()
  .resolve(async ({ request }) => {
    const token = request.headers.get("authorization");
    // Simulate async user lookup
    const user: User | null = token
      ? { id: "1", name: "John", email: "john@example.com" }
      : null;
    return { user };
  })
  .get("/me", ({ user }) => {
    // user is typed as User | null
    if (!user) {
      return { error: "Not authenticated" };
    }
    return { name: user.name, email: user.email };
  });

// ============================================================================
// Example 6: Decorators
// ============================================================================

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
};

const app6 = kito()
  .decorate("logger", logger)
  .decorate("db", { query: async (sql: string) => [] })
  .get("/", ({ logger, db }) => {
    // logger is typed with info and error methods
    // db is typed with query method
    logger.info("Hello!");
    return { status: "ok" };
  });

// ============================================================================
// Example 7: Plugin System
// ============================================================================

// Create a reusable auth plugin
const authPlugin = kito()
  .state("sessions", new Map<string, User>())
  .derive(({ request }) => ({
    sessionId: request.headers.get("x-session-id"),
  }))
  .resolve(({ sessionId, store }) => ({
    currentUser: sessionId ? store.sessions.get(sessionId) : null,
  }));

// Use the plugin - all types are merged!
const app7 = kito()
  .use(authPlugin)
  .get("/whoami", ({ currentUser, sessionId }) => {
    // currentUser is typed as User | undefined
    // sessionId is typed as string | null
    // store.sessions is typed as Map<string, User>
    return { user: currentUser?.name ?? "anonymous" };
  });

// ============================================================================
// Example 8: Prefix for route groups
// ============================================================================

const apiV1 = kito({ prefix: "/api/v1" })
  .get("/users", () => {
    // Route is actually /api/v1/users
    return { users: [] };
  })
  .get("/users/:id", ({ params }) => {
    // Route is /api/v1/users/:id
    return { userId: params.id };
  });

// ============================================================================
// Example 9: Combined - Full Application
// ============================================================================

const fullApp = kito({ prefix: "/api" })
  // Global state
  .state("version", "2.0.0")
  .state("startTime", Date.now())

  // Global decorators
  .decorate("config", {
    env: process.env.NODE_ENV ?? "development",
    debug: true,
  })

  // Derive request metadata
  .derive(({ request }) => ({
    requestId: crypto.randomUUID(),
    clientIp: request.headers.get("x-forwarded-for") ?? "unknown",
  }))

  // Resolve authentication
  .resolve(async ({ request }) => {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    // In real app, verify token
    const userId = token ? "user_123" : null;
    return { userId };
  })

  // Routes with full type inference
  .get("/health", ({ store, config }) => ({
    status: "ok",
    version: store.version,
    uptime: Date.now() - store.startTime,
    env: config.env,
  }))

  .get("/users/:id", ({ params, userId, requestId }) => ({
    // params.id - string (from path)
    // userId - string | null (from resolve)
    // requestId - string (from derive)
    targetUser: params.id,
    requestedBy: userId,
    requestId,
  }))

  .post("/users", ({ body, userId }) => {
    // In real app, body would be typed by schema
    return { created: true, by: userId };
  });

// ============================================================================
// Type Tests - These should compile without errors
// ============================================================================

// Test that path params are extracted correctly
type TestParams1 = typeof app1 extends Kito<any, any, any, infer R, any, any>
  ? R extends { users: { ":id": { get: { params: infer P } } } }
    ? P
    : never
  : never;

// This should be { id: string }
const _testParams1: TestParams1 = { id: "123" };

// Test that store types accumulate
type TestStore = typeof app2 extends Kito<any, infer S, any, any, any, any>
  ? S["store"]
  : never;

// This should be { counter: number, config: { debug: boolean, version: string } }
const _testStore: TestStore = {
  counter: 0,
  config: { debug: true, version: "1.0.0" },
};

// Test that derive types accumulate
type TestDerive = typeof app4 extends Kito<any, infer S, any, any, any, any>
  ? S["derive"]
  : never;

// This should include both authToken and isAuthenticated
const _testDerive: TestDerive = {
  authToken: "token",
  isAuthenticated: true,
};

// ============================================================================
// Example 10: Type-Safe Client (Treaty-like)
// ============================================================================

import { client } from "../../packages/kitojs/src/client";

// First, define your server with routes
const serverApp = kito()
  .get("/", () => ({ message: "Hello, World!" }))
  .get("/users", () => [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ])
  .get("/users/:id", ({ params }) => ({
    id: params.id,
    name: "Alice",
    email: "alice@example.com",
  }))
  .post("/users", ({ body }) => ({
    created: true,
    id: "new-id",
    ...(body as { name: string; email: string }),
  }))
  .put("/users/:id", ({ params, body }) => ({
    updated: true,
    id: params.id,
    ...(body as { name?: string }),
  }))
  .delete("/users/:id", ({ params }) => ({
    deleted: true,
    id: params.id,
  }))
  .get("/posts/:postId/comments/:commentId", ({ params }) => ({
    postId: params.postId,
    commentId: params.commentId,
    content: "Great post!",
  }));

// Export the app type for client usage
export type ServerApp = typeof serverApp;

/**
 * Type-safe client usage example
 *
 * The client provides:
 * - Automatic path building via property access
 * - Path parameter handling via function calls
 * - HTTP method calls (get, post, put, delete, patch)
 * - Type-safe request/response structure
 */
async function clientExamples() {
  // Create a type-safe client (at runtime, types ensure correct usage)
  const api = client<ServerApp>("http://localhost:3000");

  // GET request to root
  const homeResult = await api.get();
  console.log("Home:", homeResult.data);

  // GET list of users
  const usersResult = await api.users.get();
  console.log("Users:", usersResult.data);

  // GET with path parameter - use function call syntax
  const userResult = await api.users({ id: "123" }).get();
  console.log("User:", userResult.data);

  // POST with body
  const createResult = await api.users.post({
    name: "Charlie",
    email: "charlie@example.com",
  });
  console.log("Created:", createResult.data);

  // PUT with path param and body
  const updateResult = await api.users({ id: "123" }).put({
    name: "Updated Name",
  });
  console.log("Updated:", updateResult.data);

  // DELETE with path param
  const deleteResult = await api.users({ id: "123" }).delete();
  console.log("Deleted:", deleteResult.data);

  // Nested path parameters
  const commentResult = await api
    .posts({ postId: "1" })
    .comments({ commentId: "42" })
    .get();
  console.log("Comment:", commentResult.data);

  // Error handling
  const { data, error, status } = await api.users({ id: "nonexistent" }).get();
  if (error) {
    console.error(`Error ${status}:`, error.value);
  } else {
    console.log("Success:", data);
  }

  // With query parameters
  const filteredResult = await api.users.get({
    query: { limit: 10, offset: 0 },
  });
  console.log("Filtered:", filteredResult.data);

  // With custom headers
  const authResult = await api.users.get({
    headers: { Authorization: "Bearer token" },
  });
  console.log("Auth result:", authResult.data);
}

// ============================================================================
// Run Example
// ============================================================================

async function main() {
  const app = kito()
    .state("requestCount", 0)
    .derive(({ store }) => {
      store.requestCount++;
      return { requestNumber: store.requestCount };
    })
    .get("/", ({ requestNumber }) => ({
      message: "Hello, Kito!",
      request: requestNumber,
    }))
    .get("/users/:id", ({ params }) => ({
      userId: params.id,
    }));

  console.log("Starting type-safe Kito server...");
  // Uncomment to actually run:
  // await app.listen(3000, () => {
  //   console.log("Server running at http://localhost:3000");
  // });
}

// Export for type testing
export { app1, app2, app3, app4, app5, app6, app7, apiV1, fullApp, serverApp };
