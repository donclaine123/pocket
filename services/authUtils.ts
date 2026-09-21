/**
 * Utility to reliably extract authentication parameters (tokens, PKCE code, error messages)
 * from deep links and web URLs, handling both query parameters (?) and hash fragments (#).
 */
export type AuthParams = {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  tokenHash?: string;
  type?: string;
  errorDescription?: string;
};

export function extractAuthParams(url: string): AuthParams {
  const result: AuthParams = {};
  if (!url) return result;

  const qIndex = url.indexOf("?");
  const hIndex = url.indexOf("#");

  const searchPart =
    qIndex !== -1
      ? hIndex !== -1 && hIndex > qIndex
        ? url.slice(qIndex + 1, hIndex)
        : url.slice(qIndex + 1)
      : "";
  const hashPart = hIndex !== -1 ? url.slice(hIndex + 1) : "";

  for (const part of [searchPart, hashPart]) {
    if (!part) continue;
    const pairs = part.split("&");
    for (const pair of pairs) {
      const [rawKey, rawVal] = pair.split("=");
      if (!rawKey) continue;
      const key = decodeURIComponent(rawKey);
      const val = rawVal ? decodeURIComponent(rawVal.replace(/\+/g, " ")) : "";

      if (key === "access_token") result.accessToken = val;
      if (key === "refresh_token") result.refreshToken = val;
      if (key === "code") result.code = val;
      if (key === "token_hash") result.tokenHash = val;
      if (key === "type") result.type = val;
      if (key === "error_description") result.errorDescription = val;
      if (key === "error_code" && val === "otp_expired") {
        result.errorDescription = "Verification link has expired. Please request a fresh one.";
      }
    }
  }

  return result;
}
