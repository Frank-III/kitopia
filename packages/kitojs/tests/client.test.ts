import {
  describe,
  it,
  expect,
  expectTypeOf,
  vi,
  beforeAll,
  afterAll,
} from "vitest";
import { kito, client, type Client } from "../src";

// ============================================================================
// Type Tests
// ============================================================================

describe("Client Type Safety", () => {
  // Create a test app for type inference
  const createTestApp = () =>
    kito()
      .state("version", "1.0.0")
      .get("/", () => ({ message: "Hello" }))
      .get("/users", () => [{ id: "1", name: "John" }])
      .get("/users/:id", ({ params }) => ({
        id: params.id,
        name: "John",
        email: "john@example.com",
      }))
      .post("/users", ({ body }) => ({
        created: true,
        id: "new-id",
        ...(body as { name: string; email: string }),
      }))
      .put("/users/:id", ({ params, body }) => ({
        updated: true,
        id: params.id,
        ...(body as { name?: string; email?: string }),
      }))
      .delete("/users/:id", ({ params }) => ({
        deleted: true,
        id: params.id,
      }))
      .get("/posts/:postId/comments/:commentId", ({ params }) => ({
        postId: params.postId,
        commentId: params.commentId,
      }));

  type TestApp = ReturnType<typeof createTestApp>;

  it("should infer route types from app", () => {
    type Routes = TestApp["~Routes"];

    // Check that routes are accumulated
    expectTypeOf<Routes>().toHaveProperty("users");
  });

  it("should create client with correct types", () => {
    const api = client<TestApp>("http://localhost:3000");

    // Root route
    expectTypeOf(api).toHaveProperty("get");

    // Users routes
    expectTypeOf(api).toHaveProperty("users");
    expectTypeOf(api.users).toHaveProperty("get");
    expectTypeOf(api.users).toHaveProperty("post");
  });

  it("should type GET responses correctly", () => {
    const api = client<TestApp>("http://localhost:3000");

    // The get method should return a Promise
    type UsersGetReturn = ReturnType<typeof api.users.get>;
    expectTypeOf<UsersGetReturn>().toMatchTypeOf<Promise<unknown>>();
  });

  it("should type POST body correctly", () => {
    const api = client<TestApp>("http://localhost:3000");

    // Post should accept a body
    expectTypeOf(api.users.post).toBeFunction();
  });

  it("should handle path parameters", () => {
    const api = client<TestApp>("http://localhost:3000");

    // Path parameter function should exist
    expectTypeOf(api.users).toBeFunction();
  });

  it("should handle nested path parameters", () => {
    const api = client<TestApp>("http://localhost:3000");

    // Nested routes
    expectTypeOf(api).toHaveProperty("posts");
  });
});

// ============================================================================
// Runtime Tests (with mocked fetch)
// ============================================================================

describe("Client Runtime", () => {
  const mockFetch = vi.fn();

  beforeAll(() => {
    // Mock global fetch
    vi.stubGlobal("fetch", mockFetch);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("should make GET request to correct URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [{ id: "1", name: "John" }],
    });

    const api = client<any>("http://localhost:3000");
    await api.users.get();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("should make POST request with body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ created: true, id: "new" }),
    });

    const api = client<any>("http://localhost:3000");
    await api.users.post({ name: "John", email: "john@example.com" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "John", email: "john@example.com" }),
        headers: expect.objectContaining({
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("should handle path parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "123", name: "John" }),
    });

    const api = client<any>("http://localhost:3000");
    await api.users({ id: "123" }).get();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users/123",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("should handle nested path parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ postId: "1", commentId: "2" }),
    });

    const api = client<any>("http://localhost:3000");
    await api.posts({ postId: "1" }).comments({ commentId: "2" }).get();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/posts/1/comments/2",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("should add query parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [],
    });

    const api = client<any>("http://localhost:3000");
    await api.users.get({ query: { limit: "10", offset: "0" } });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users?limit=10&offset=0",
      expect.anything(),
    );
  });

  it("should include custom headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [],
    });

    const api = client<any>("http://localhost:3000", {
      headers: { Authorization: "Bearer token" },
    });
    await api.users.get();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
  });

  it("should call onRequest hook", async () => {
    const onRequest = vi.fn((path, init) => init);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [],
    });

    const api = client<any>("http://localhost:3000", { onRequest });
    await api.users.get();

    expect(onRequest).toHaveBeenCalledWith("/users", expect.any(Object));
  });

  it("should call onResponse hook", async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [],
      clone: () => response,
    };
    mockFetch.mockResolvedValueOnce(response);

    const onResponse = vi.fn();
    const api = client<any>("http://localhost:3000", { onResponse });
    await api.users.get();

    expect(onResponse).toHaveBeenCalled();
  });

  it("should handle error responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "Not found" }),
    });

    const api = client<any>("http://localhost:3000");
    const result = await api.users({ id: "nonexistent" }).get();

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      status: 404,
      value: { message: "Not found" },
    });
    expect(result.status).toBe(404);
  });

  it("should return successful response structure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "1", name: "John" }),
    });

    const api = client<any>("http://localhost:3000");
    const result = await api.users.get();

    expect(result.data).toEqual({ id: "1", name: "John" });
    expect(result.error).toBeNull();
    expect(result.status).toBe(200);
    expect(result.response).toBeDefined();
    expect(result.headers).toBeDefined();
  });

  it("should normalize domain without protocol", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [],
    });

    const api = client<any>("localhost:3000");
    await api.users.get();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users",
      expect.anything(),
    );
  });

  it("should use https for non-local domains", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [],
    });

    const api = client<any>("api.example.com");
    await api.users.get();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/users",
      expect.anything(),
    );
  });

  it("should handle DELETE requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ deleted: true }),
    });

    const api = client<any>("http://localhost:3000");
    await api.users({ id: "123" }).delete();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users/123",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });

  it("should handle PUT requests with body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ updated: true }),
    });

    const api = client<any>("http://localhost:3000");
    await api.users({ id: "123" }).put({ name: "Updated" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users/123",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ name: "Updated" }),
      }),
    );
  });

  it("should handle PATCH requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ patched: true }),
    });

    const api = client<any>("http://localhost:3000");
    await api.users({ id: "123" }).patch({ name: "Patched" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/users/123",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
  });

  it("should handle text responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      text: async () => "Hello World",
    });

    const api = client<any>("http://localhost:3000");
    const result = await api.health.get();

    expect(result.data).toBe("Hello World");
  });

  it("should support dynamic headers function", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [],
    });

    const api = client<any>("http://localhost:3000", {
      headers: async () => ({ Authorization: "Bearer dynamic-token" }),
    });
    await api.users.get();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer dynamic-token",
        }),
      }),
    );
  });
});

// ============================================================================
// Client.InferData and Client.InferError Tests
// ============================================================================

describe("Client Type Helpers", () => {
  it("should have InferData type helper", () => {
    // This is a compile-time test - if it compiles, it works
    type MockMethod = () => Promise<Client.Result<{ 200: { id: string } }>>;
    type Data = Client.InferData<MockMethod>;

    // Data should be { id: string }
    const data: Data = { id: "test" };
    expect(data.id).toBe("test");
  });

  it("should have InferError type helper", () => {
    // This is a compile-time test
    type MockMethod = () => Promise<
      Client.Result<{ 200: { id: string }; 404: { message: string } }>
    >;
    type Error = Client.InferError<MockMethod>;

    // Error should include the 404 shape
    const error: Error = { status: 404, value: { message: "Not found" } };
    expect(error.status).toBe(404);
  });
});
