export type HttpStatusKind = "success" | "redirect" | "client_error" | "server_error" | "other";

export const REDIRECT_GUIDANCE = "供应商接口已重定向，请检查配置的目标 URL";
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

export function classifyHttpStatus(statusCode: number): HttpStatusKind {
  if (statusCode >= 200 && statusCode < 300) return "success";
  if (isRedirectStatus(statusCode)) return "redirect";
  if (statusCode >= 400 && statusCode < 500) return "client_error";
  if (statusCode >= 500 && statusCode < 600) return "server_error";
  return "other";
}

export function isSuccessfulHttpStatus(statusCode: number): boolean {
  return classifyHttpStatus(statusCode) === "success";
}

export function isRedirectStatus(statusCode: number): boolean {
  return REDIRECT_STATUS_CODES.has(statusCode);
}

export function httpStatusGuidance(statusCode: number): string | undefined {
  return isRedirectStatus(statusCode) ? REDIRECT_GUIDANCE : undefined;
}
