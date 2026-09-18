const secretPatterns = [
  /Bearer\s+[^\s]+/gi,
  /\b(api[_-]?key|token|secret|password)\s*[=:]\s*[^\s,;]+/gi,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
];

export function sanitizeLogValue(value: unknown) {
  let text =
    value instanceof Error
      ? `${value.name}: ${value.message}\n${value.stack || ""}`
      : String(value);
  for (const pattern of secretPatterns) text = text.replace(pattern, "[redacted]");
  return text.slice(0, 4000);
}

export function publicErrorBody(error: string, requestId: string) {
  return { error, requestId };
}

export function logServerError(
  operation: string,
  requestId: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const safeContext = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeLogValue(value)]),
  );
  console.error(
    JSON.stringify({
      level: "error",
      operation,
      requestId,
      error: sanitizeLogValue(error),
      ...safeContext,
    }),
  );
}

export function serverError(
  operation: string,
  error: unknown,
  publicMessage: string,
  status = 500,
  context: Record<string, unknown> = {},
) {
  const requestId = crypto.randomUUID();
  logServerError(operation, requestId, error, context);
  return Response.json(publicErrorBody(publicMessage, requestId), { status });
}
