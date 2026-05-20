const SECRET_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /\btoken\b/i,
  /api[_-]?key/i,
  /apikey/i,
  /auth[_-]?key/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /client[_-]?secret/i,
];

export function redactSecrets(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value as object)) {
    return "[Circular]";
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return (value as unknown[]).map((v) => redactSecrets(v, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))
      ? "[REDACTED]"
      : redactSecrets(val, seen);
  }
  return result;
}

export function containsSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}
