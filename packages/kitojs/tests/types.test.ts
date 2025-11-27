// biome-ignore assist/source/organizeImports: ...
import { describe, expectTypeOf, it } from "vitest";
// Import existing server tests from src (requires kito-core at runtime)
import { server, schema, t, type Context } from "../src";
// Import new type-safe kito directly to avoid kito-core dependency chain
import { kito, Kito } from "../src/server/kito";
import type {
  ResolvePath,
  GetPathParameter,
  JoinPath,
  Prettify,
} from "../src/types/utils";

describe("Type Safety", () => {
  it("should infer schema types correctly", () => {
    const userSchema = schema({
      params: t.object({
        id: t.str().uuid(),
      }),
      query: t.object({
        limit: t.num().default(10),
      }),
      body: t.object({
        name: t.str(),
        email: t.str().email(),
        age: t.num().optional(),
      }),
    });

    type UserContext = Context<typeof userSchema>;

    expectTypeOf<UserContext["req"]["params"]>().toMatchTypeOf<{
      id: string;
    }>();

    expectTypeOf<UserContext["req"]["query"]>().toMatchTypeOf<{
      limit: number;
    }>();

    expectTypeOf<UserContext["req"]["body"]>().toMatchTypeOf<{
      name: string;
      email: string;
      age?: number;
    }>();
  });

  it("should infer optional fields", () => {
    const optionalSchema = schema({
      query: t.object({
        search: t.str().optional(),
        page: t.num().default(1),
      }),
    });

    type OptionalContext = Context<typeof optionalSchema>;

    expectTypeOf<OptionalContext["req"]["query"]>().toMatchTypeOf<{
      search?: string;
      page: number;
    }>();
  });

  it("should infer array types", () => {
    const arraySchema = schema({
      body: t.object({
        tags: t.array(t.str()),
        scores: t.array(t.num()),
      }),
    });

    type ArrayContext = Context<typeof arraySchema>;

    expectTypeOf<ArrayContext["req"]["body"]>().toMatchTypeOf<{
      tags: string[];
      scores: number[];
    }>();
  });

  it("should infer nested object types", () => {
    const nestedSchema = schema({
      body: t.object({
        user: t.object({
          name: t.str(),
          profile: t.object({
            bio: t.str(),
            avatar: t.str().url().optional(),
          }),
        }),
      }),
    });

    type NestedContext = Context<typeof nestedSchema>;

    expectTypeOf<NestedContext["req"]["body"]>().toMatchTypeOf<{
      user: {
        name: string;
        profile: {
          bio: string;
          avatar?: string;
        };
      };
    }>();
  });

  it("should infer literal types", () => {
    const literalSchema = schema({
      body: t.object({
        role: t.union(
          t.literal("admin"),
          t.literal("user"),
          t.literal("guest"),
        ),
        status: t.literal("active"),
      }),
    });

    type LiteralContext = Context<typeof literalSchema>;

    expectTypeOf<LiteralContext["req"]["body"]>().toMatchTypeOf<{
      role: "admin" | "user" | "guest";
      status: "active";
    }>();
  });

  it("should support extended context types", () => {
    interface Database {
      // biome-ignore lint/suspicious/noExplicitAny: ...
      query: (sql: string) => any;
    }

    const app = server().extend<{ db: Database }>((ctx) => {
      ctx.db = { query: () => {} };
    });

    app.get("/", (ctx) => {
      expectTypeOf(ctx).toHaveProperty("db");
      expectTypeOf(ctx.db).toHaveProperty("query");
    });
  });

  it("should chain extension types", () => {
    interface DB {
      query: () => void;
    }
    interface Cache {
      get: () => void;
    }

    const app = server()
      .extend<{ db: DB }>(() => ({ db: { query: () => {} } }))
      .extend<{ cache: Cache }>(() => ({ cache: { get: () => {} } }));

    app.get("/", (ctx) => {
      expectTypeOf(ctx).toHaveProperty("db");
      expectTypeOf(ctx).toHaveProperty("cache");
    });
  });
});

// ============================================================================
// New Type-Safe Kito Class Tests
// ============================================================================

describe("Path Parameter Extraction Types", () => {
  it("should extract single path parameter", () => {
    expectTypeOf<GetPathParameter<"/users/:id">>().toEqualTypeOf<"id">();
  });

  it("should extract multiple path parameters", () => {
    expectTypeOf<
      GetPathParameter<"/users/:userId/posts/:postId">
    >().toEqualTypeOf<"userId" | "postId">();
  });

  it("should handle paths without parameters", () => {
    expectTypeOf<GetPathParameter<"/users">>().toEqualTypeOf<never>();
  });

  it("should handle wildcard", () => {
    expectTypeOf<GetPathParameter<"/files/*">>().toEqualTypeOf<"*">();
  });

  it("should resolve path to params object", () => {
    expectTypeOf<ResolvePath<"/users/:id">>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<ResolvePath<"/users/:userId/posts/:postId">>().toEqualTypeOf<{
      userId: string;
      postId: string;
    }>();
  });

  it("should handle empty path", () => {
    expectTypeOf<ResolvePath<"">>().toEqualTypeOf<{}>();
  });
});

describe("JoinPath Type", () => {
  it("should join empty prefix with path", () => {
    expectTypeOf<JoinPath<"", "/users">>().toEqualTypeOf<"/users">();
  });

  it("should join prefix with path", () => {
    expectTypeOf<JoinPath<"/api", "/users">>().toEqualTypeOf<"/api/users">();
  });

  it("should handle prefix without trailing slash", () => {
    expectTypeOf<
      JoinPath<"/api/v1", "/users">
    >().toEqualTypeOf<"/api/v1/users">();
  });
});

describe("New Kito Class Type Safety", () => {
  it("should infer path parameters in route handler", () => {
    const app = kito().get("/users/:id", ({ params }) => {
      expectTypeOf(params).toHaveProperty("id");
      expectTypeOf(params.id).toBeString();
      return { id: params.id };
    });
  });

  it("should infer multiple path parameters", () => {
    const app = kito().get("/users/:userId/posts/:postId", ({ params }) => {
      expectTypeOf(params).toHaveProperty("userId");
      expectTypeOf(params).toHaveProperty("postId");
      expectTypeOf(params.userId).toBeString();
      expectTypeOf(params.postId).toBeString();
      return params;
    });
  });

  it("should accumulate state types", () => {
    const app = kito()
      .state("counter", 0)
      .state("name", "test")
      .get("/", ({ store }) => {
        expectTypeOf(store).toHaveProperty("counter");
        expectTypeOf(store).toHaveProperty("name");
        expectTypeOf(store.counter).toBeNumber();
        expectTypeOf(store.name).toBeString();
        return store;
      });

    // Check type at class level
    type AppType = typeof app;
    type StoreType = AppType["~Singleton"]["store"];
    expectTypeOf<StoreType>().toMatchTypeOf<{
      counter: number;
      name: string;
    }>();
  });

  it("should accumulate derive types", () => {
    const app = kito()
      .derive(() => ({
        timestamp: Date.now(),
      }))
      .derive(() => ({
        requestId: "abc",
      }))
      .get("/", ({ timestamp, requestId }) => {
        expectTypeOf(timestamp).toBeNumber();
        expectTypeOf(requestId).toBeString();
        return { timestamp, requestId };
      });

    // Check accumulated derive types
    type AppType = typeof app;
    type DeriveType = AppType["~Singleton"]["derive"];
    expectTypeOf<DeriveType>().toMatchTypeOf<{
      timestamp: number;
      requestId: string;
    }>();
  });

  it("should accumulate resolve types", () => {
    interface User {
      id: string;
      name: string;
    }

    const app = kito()
      .resolve(async () => {
        const user: User | null = { id: "1", name: "John" };
        return { user };
      })
      .get("/", ({ user }) => {
        expectTypeOf(user).toEqualTypeOf<User | null>();
        return user;
      });
  });

  it("should type decorators correctly", () => {
    const logger = {
      info: (msg: string) => console.log(msg),
      error: (msg: string) => console.error(msg),
    };

    const app = kito()
      .decorate("logger", logger)
      .decorate("version", "1.0.0")
      .get("/", ({ logger, version }) => {
        expectTypeOf(logger).toHaveProperty("info");
        expectTypeOf(logger).toHaveProperty("error");
        expectTypeOf(version).toBeString();
        return { version };
      });
  });

  it("should merge plugin types with use()", () => {
    const authPlugin = kito()
      .state("sessions", new Map<string, { name: string }>())
      .derive(() => ({
        isAuth: true,
      }));

    const app = kito()
      .state("counter", 0)
      .use(authPlugin)
      .get("/", ({ store, isAuth }) => {
        // Should have both counter from main app and sessions from plugin
        expectTypeOf(store).toHaveProperty("counter");
        expectTypeOf(store).toHaveProperty("sessions");
        expectTypeOf(store.counter).toBeNumber();
        expectTypeOf(isAuth).toBeBoolean();
        return { isAuth };
      });
  });

  it("should handle prefix in routes", () => {
    const app = kito({ prefix: "/api/v1" }).get("/users/:id", ({ params }) => {
      expectTypeOf(params).toHaveProperty("id");
      return { id: params.id };
    });

    // The route should be registered as /api/v1/users/:id
    type AppType = typeof app;
    expectTypeOf<AppType["~BasePath"]>().toEqualTypeOf<"/api/v1">();
  });

  it("should chain all state methods correctly", () => {
    const app = kito()
      .state("config", { debug: true })
      .decorate("db", { query: (sql: string) => [] as any[] })
      .derive(({ request }) => ({
        userAgent: "test",
      }))
      .resolve(async () => ({
        currentTime: new Date(),
      }))
      .get("/", ({ store, db, userAgent, currentTime }) => {
        expectTypeOf(store.config).toMatchTypeOf<{ debug: boolean }>();
        expectTypeOf(db.query).toBeFunction();
        expectTypeOf(userAgent).toBeString();
        expectTypeOf(currentTime).toMatchTypeOf<Date>();
        return "ok";
      });
  });

  it("should work with schema validation", () => {
    const userSchema = schema({
      params: t.object({
        id: t.str().uuid(),
      }),
      body: t.object({
        name: t.str().min(1),
        email: t.str().email(),
        age: t.num().optional(),
      }),
    });

    const app = kito().post("/users/:id", userSchema, ({ params, body }) => {
      // params should be typed from schema
      expectTypeOf(params.id).toBeString();
      // body should be typed from schema
      expectTypeOf(body.name).toBeString();
      expectTypeOf(body.email).toBeString();
      // age is optional
      expectTypeOf(body.age).toEqualTypeOf<number | undefined>();
      return { success: true };
    });
  });
});
