/**
 * Minimal Admin GraphQL client for the seed script.
 *
 * Deliberate shortcut, logged in docs/decisions.md (run 1.1): the Admin schema
 * is not in codegen, so response shapes are hand-typed at each call site and a
 * wrong field fails at runtime with Shopify's message, not at `pnpm codegen`.
 */

export type AdminClient = {
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
  scopes: string[];
  domain: string;
  version: string;
};

export type UserError = { field?: string[] | null; message: string };

export type Connection<N> = {
  nodes: N[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type GraphQLError = { message: string; extensions?: { code?: string } };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; see .env.example`);
  return value;
}

/**
 * Client-credentials grant for a Dev Dashboard app installed on one store.
 * The token lives 24 hours, long enough for any seed run, so it is not cached.
 */
async function clientCredentialsToken(domain: string): Promise<string> {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env("SHOPIFY_ADMIN_CLIENT_ID"),
      client_secret: env("SHOPIFY_ADMIN_CLIENT_SECRET"),
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Admin token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function adminClient(): Promise<AdminClient> {
  const domain = env("SHOPIFY_STORE_DOMAIN");
  const version = env("SHOPIFY_API_VERSION");
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || (await clientCredentialsToken(domain));
  const endpoint = `https://${domain}/admin/api/${version}/graphql.json`;

  async function query<T>(document: string, variables?: Record<string, unknown>, attempt = 0): Promise<T> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: document, variables }),
    });
    if (res.status === 429 && attempt < 5) {
      await sleep(1000 * (attempt + 1));
      return query(document, variables, attempt + 1);
    }
    if (!res.ok) throw new Error(`Admin API responded ${res.status} ${res.statusText}: ${await res.text()}`);
    const json = (await res.json()) as { data?: T; errors?: GraphQLError[] };
    if (json.errors?.length) {
      const throttled = json.errors.some((e) => e.extensions?.code === "THROTTLED");
      if (throttled && attempt < 5) {
        await sleep(1000 * (attempt + 1));
        return query(document, variables, attempt + 1);
      }
      throw new Error(`Admin API errors:\n  ${json.errors.map((e) => e.message).join("\n  ")}`);
    }
    if (!json.data) throw new Error("Admin API returned no data");
    return json.data;
  }

  const { currentAppInstallation } = await query<{
    currentAppInstallation: { accessScopes: { handle: string }[] };
  }>(`{ currentAppInstallation { accessScopes { handle } } }`);

  return { query, scopes: currentAppInstallation.accessScopes.map((s) => s.handle), domain, version };
}

export function assertNoUserErrors(label: string, errors: UserError[]): void {
  if (!errors.length) return;
  const lines = errors.map((e) => `${e.field?.join(".") ?? ""} ${e.message}`.trim());
  throw new Error(`${label}: ${lines.join("; ")}`);
}

/** Walks a cursor connection to its end. `select` picks the connection out of a page. */
export async function paginate<N, D>(
  client: AdminClient,
  document: string,
  variables: Record<string, unknown>,
  select: (data: D) => Connection<N>
): Promise<N[]> {
  const all: N[] = [];
  let after: string | null = null;
  for (;;) {
    const page = select(await client.query<D>(document, { ...variables, after }));
    all.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) return all;
    after = page.pageInfo.endCursor;
  }
}
