export type PublicAgentRailConfig = {
  siteUrl: URL;
  sourceUrl: URL | null;
  contactUrl: URL | null;
  testerIntakeUrl: URL | null;
};

const DEFAULT_SITE_URL = new URL("https://agentrail.id/");

function safeHttpsUrl(value: string | undefined): URL | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (
      url.protocol !== "https:" ||
      url.hostname.length === 0 ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return null;
    }
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function canonicalSiteUrl(value: string | undefined): URL {
  const url = safeHttpsUrl(value);
  if (url === null) return new URL(DEFAULT_SITE_URL);
  return new URL(url.origin);
}

export function readPublicAgentRailConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): PublicAgentRailConfig {
  return {
    siteUrl: canonicalSiteUrl(env.NEXT_PUBLIC_AGENTRAIL_SITE_URL),
    sourceUrl: safeHttpsUrl(env.NEXT_PUBLIC_AGENTRAIL_SOURCE_URL),
    contactUrl: safeHttpsUrl(env.NEXT_PUBLIC_AGENTRAIL_CONTACT_URL),
    testerIntakeUrl: safeHttpsUrl(env.NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL),
  };
}
