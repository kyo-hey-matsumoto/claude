import { cookies } from "next/headers";
import { readSessionValue, mintApiToken, SESSION_COOKIE_NAME } from "./auth/session";

// Formatting helpers live in ./format; re-exported here so existing imports keep working.
export { money, dateTime, statusClass } from "./format";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export type CourseSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  imagePath?: string | null;
  imageAltText?: string | null;
  providerName: string;
  availableForSale?: boolean;
  shopifyHandle?: string;
  offerings: Array<{
    id: string;
    title: string;
    status: string;
    priceCents: number;
    currencyCode?: string;
    availableForSale?: boolean;
    startsAt: string;
    endsAt: string;
  }>;
};

export type ExperienceSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  media: Array<{ url: string; altText: string }>;
  nextSlot?: { startsAt: string } | null;
  startingPriceCents: number;
  currencyCode?: string;
  availableForSale?: boolean;
  shopifyHandle?: string;
  eligibility: { eligible: boolean; reasons: string[] };
};

export type CourseDetail = CourseSummary & {
  description: string;
  offerings: Array<CourseSummary["offerings"][number] & { sessions: Array<{ id: string; title: string; sequenceNo: number }> }>;
};

export type ExperienceDetail = ExperienceSummary & {
  description: string;
  locked: boolean;
  slots: Array<{ id: string; startsAt: string; endsAt: string; capacity: number; status: string }>;
  categories: Array<{ id: string; code: string; label: string; priceCents: number; capacityWeight: string }>;
};

async function buildAuthHeaders(): Promise<Record<string, string>> {
  try {
    const store = await cookies();
    const raw = store.get(SESSION_COOKIE_NAME)?.value;
    const session = raw ? await readSessionValue(raw) : null;
    if (session) {
      try {
        const token = await mintApiToken(session);
        return { authorization: `Bearer ${token}` };
      } catch (error) {
        // A valid session exists but minting the API token failed (e.g. WEB_API_JWT_SECRET unset).
        // Fail safe (proceed unauthenticated) but surface the misconfiguration instead of hiding it as a 401.
        console.warn("apiFetch: failed to mint API token for an authenticated session", error);
      }
    }
  } catch {
    // proceed unauthenticated (public pages must still render)
  }
  return {};
}

async function rawApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl =
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const authHeaders = await buildAuthHeaders();

  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeaders,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, `API ${path} failed: ${response.status} ${text}`);
  }

  return response;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await rawApiFetch(path, init);
  return response.json() as Promise<T>;
}

export async function apiFetchText(path: string, init?: RequestInit): Promise<string> {
  const response = await rawApiFetch(path, init);
  return response.text();
}

