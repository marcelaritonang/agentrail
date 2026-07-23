const SOURCE_ERROR =
  "NEXT_PUBLIC_AGENTRAIL_SOURCE_URL must be an absolute https:// URL";

export function configuredSourceUrl(
  value = process.env.NEXT_PUBLIC_AGENTRAIL_SOURCE_URL,
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(SOURCE_ERROR);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.length === 0 ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new Error(SOURCE_ERROR);
  }
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function sourceQuickstartUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  url.hash = "local-quickstart";
  return url.toString();
}
