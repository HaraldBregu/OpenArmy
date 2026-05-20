import { describe, expect, it } from "vitest";
import { redactSecrets, containsSecretKey } from "../src/runtime/secret-redactor.js";

describe("redactSecrets", () => {
  it("redacts fields with sensitive key names", () => {
    const result = redactSecrets({
      username: "alice",
      password: "supersecret",
      apiKey: "key-123",
      token: "tok-abc",
    });
    expect(result).toMatchObject({
      username: "alice",
      password: "[REDACTED]",
      apiKey: "[REDACTED]",
      token: "[REDACTED]",
    });
  });

  it("redacts nested sensitive fields", () => {
    const result = redactSecrets({
      config: {
        database: {
          password: "db-pass",
          host: "localhost",
        },
      },
    });
    expect((result as Record<string, Record<string, Record<string, unknown>>>).config.database.password).toBe("[REDACTED]");
    expect((result as Record<string, Record<string, Record<string, unknown>>>).config.database.host).toBe("localhost");
  });

  it("handles arrays without redacting non-secret values", () => {
    const result = redactSecrets([{ name: "x" }, { secret: "val" }]);
    expect(Array.isArray(result)).toBe(true);
    const arr = result as Array<Record<string, unknown>>;
    expect(arr[0].name).toBe("x");
    expect(arr[1].secret).toBe("[REDACTED]");
  });

  it("passes through primitives unchanged", () => {
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets("hello")).toBe("hello");
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets(true)).toBe(true);
  });

  it("handles circular references without throwing", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj["self"] = obj;
    expect(() => redactSecrets(obj)).not.toThrow();
  });

  it("redacts clientSecret and privateKey", () => {
    const result = redactSecrets({
      clientSecret: "cs-abc",
      privateKey: "pk-xyz",
      credential: "cred-123",
    });
    expect(result).toMatchObject({
      clientSecret: "[REDACTED]",
      privateKey: "[REDACTED]",
      credential: "[REDACTED]",
    });
  });
});

describe("containsSecretKey", () => {
  it("identifies secret keys", () => {
    expect(containsSecretKey("password")).toBe(true);
    expect(containsSecretKey("api_key")).toBe(true);
    expect(containsSecretKey("accessKey")).toBe(true);
  });

  it("does not flag innocent keys", () => {
    expect(containsSecretKey("username")).toBe(false);
    expect(containsSecretKey("host")).toBe(false);
    expect(containsSecretKey("port")).toBe(false);
  });
});
