/**
 * Seeds the Shopify store with the filler catalogue in scripts/catalogue.json.
 *
 *   pnpm seed                  wipe previously seeded products, re-create everything, publish
 *   pnpm seed --check          report token, scopes, and what is missing; change nothing
 *   pnpm seed --dry-run        validate and print the plan; change nothing
 *   pnpm seed --skip-images    create products without images (fast iteration on copy and prices)
 *   pnpm seed --wipe-others    also delete every product NOT carrying the seed tag (Shopify's test data)
 *   pnpm seed --only <handle>  re-seed one product; skips collections and wiping
 *
 * Idempotent: every seeded product carries `seedTag`, and a run deletes those
 * first. Collections are matched by handle and re-created. Real products go
 * into catalogue.json and replace the filler through the same script.
 */
import { adminClient, assertNoUserErrors, env, paginate, type AdminClient, type Connection, type UserError } from "./admin.ts";
import { descriptionHtml, expandVariants, readCatalogue, type Catalogue, type CatalogueCollection, type CatalogueProduct } from "./catalogue.ts";
import { altText, artFilename, artPng } from "./generate-art.ts";

const REQUIRED_SCOPES = ["write_products", "write_inventory", "write_files"];
const PUBLISH_SCOPE = "write_publications";

type Flags = { check: boolean; dryRun: boolean; skipImages: boolean; wipeOthers: boolean; only?: string };

function parseFlags(argv: string[]): Flags {
  const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : undefined;
  if (argv.includes("--only") && !only) throw new Error("--only needs a product handle");
  return {
    check: argv.includes("--check"),
    dryRun: argv.includes("--dry-run"),
    skipImages: argv.includes("--skip-images"),
    wipeOthers: argv.includes("--wipe-others"),
    only,
  };
}

const log = (line: string) => console.log(line);

// --- store queries -------------------------------------------------------------

type ProductNode = { id: string; handle: string; tags: string[] };

const PRODUCTS = /* GraphQL */ `
  query Products($query: String, $after: String) {
    products(first: 50, query: $query, after: $after) {
      nodes { id handle tags }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function listProducts(admin: AdminClient, query?: string): Promise<ProductNode[]> {
  return paginate<ProductNode, { products: Connection<ProductNode> }>(admin, PRODUCTS, { query }, (d) => d.products);
}

/** Direct lookup by handle. Unlike `products(query:)`, it does not lag behind writes. */
async function findProductByHandle(admin: AdminClient, handle: string): Promise<ProductNode | null> {
  const { productByIdentifier } = await admin.query<{ productByIdentifier: ProductNode | null }>(
    `query($handle: String!) { productByIdentifier(identifier: { handle: $handle }) { id handle tags } }`,
    { handle }
  );
  return productByIdentifier;
}

async function deleteProduct(admin: AdminClient, id: string): Promise<void> {
  const { productDelete } = await admin.query<{ productDelete: { deletedProductId: string | null; userErrors: UserError[] } }>(
    `mutation($id: ID!) { productDelete(input: { id: $id }) { deletedProductId userErrors { field message } } }`,
    { id }
  );
  assertNoUserErrors(`delete ${id}`, productDelete.userErrors);
}

async function findCollection(admin: AdminClient, handle: string): Promise<{ id: string } | null> {
  const { collectionByIdentifier } = await admin.query<{ collectionByIdentifier: { id: string } | null }>(
    `query($handle: String!) { collectionByIdentifier(identifier: { handle: $handle }) { id } }`,
    { handle }
  );
  return collectionByIdentifier;
}

async function deleteCollection(admin: AdminClient, id: string): Promise<void> {
  const { collectionDelete } = await admin.query<{ collectionDelete: { userErrors: UserError[] } }>(
    `mutation($id: ID!) { collectionDelete(input: { id: $id }) { deletedCollectionId userErrors { field message } } }`,
    { id }
  );
  assertNoUserErrors(`delete collection ${id}`, collectionDelete.userErrors);
}

async function locationIds(admin: AdminClient): Promise<string[]> {
  const { locations } = await admin.query<{ locations: { nodes: { id: string }[] } }>(`{ locations(first: 10) { nodes { id } } }`);
  if (!locations.nodes.length) throw new Error("the store has no locations to hold inventory");
  return locations.nodes.map((l) => l.id);
}

// --- images ----------------------------------------------------------------------

type Upload = { resourceUrl: string; filename: string; alt: string };

/**
 * Staged upload: Shopify hands out a signed multipart target per file, the file
 * goes straight to that bucket, and the returned resourceUrl becomes the
 * product file's originalSource.
 */
async function uploadImages(admin: AdminClient, product: CatalogueProduct): Promise<Upload[]> {
  const spec = { handle: product.handle, title: product.title, motif: product.images.motif };
  const files = Array.from({ length: product.images.count }, (_, i) => ({
    filename: artFilename(spec, i),
    alt: altText(spec, i),
    bytes: artPng(spec, i),
  }));

  const { stagedUploadsCreate } = await admin.query<{
    stagedUploadsCreate: {
      stagedTargets: { url: string; resourceUrl: string; parameters: { name: string; value: string }[] }[];
      userErrors: UserError[];
    };
  }>(
    `mutation($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: files.map((f) => ({
        resource: "IMAGE",
        filename: f.filename,
        mimeType: "image/png",
        httpMethod: "POST",
        fileSize: String(f.bytes.length),
      })),
    }
  );
  assertNoUserErrors(`staged uploads for ${product.handle}`, stagedUploadsCreate.userErrors);

  const uploads: Upload[] = [];
  for (const [i, target] of stagedUploadsCreate.stagedTargets.entries()) {
    const file = files[i];
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", new Blob([new Uint8Array(file.bytes)], { type: "image/png" }), file.filename); // must be last
    const res = await fetch(target.url, { method: "POST", body: form });
    if (!res.ok) throw new Error(`upload of ${file.filename} failed: ${res.status} ${await res.text()}`);
    uploads.push({ resourceUrl: target.resourceUrl, filename: file.filename, alt: file.alt });
  }
  return uploads;
}

// --- products ----------------------------------------------------------------------

type CreatedProduct = {
  id: string;
  handle: string;
  variants: { title: string; availableForSale: boolean }[];
  mediaCount: number;
};

function productSetInput(catalogue: Catalogue, product: CatalogueProduct, locations: string[], uploads: Upload[]) {
  const options = product.options ?? [];
  const variants = expandVariants(product, catalogue.defaults);
  return {
    handle: product.handle,
    title: product.title,
    vendor: catalogue.vendor,
    productType: product.productType,
    status: "ACTIVE",
    tags: [catalogue.seedTag, ...product.tags],
    descriptionHtml: descriptionHtml(product),
    // Shopify's single-variant convention: one option "Title" with one value.
    productOptions: options.length
      ? options.map((o, i) => ({ name: o.name, position: i + 1, values: o.values.map((name) => ({ name })) }))
      : [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
    variants: variants.map((v, i) => ({
      position: i + 1,
      optionValues: v.optionValues.length ? v.optionValues : [{ optionName: "Title", name: "Default Title" }],
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? null,
      inventoryPolicy: "DENY",
      inventoryItem: { tracked: true, requiresShipping: true },
      // Stock the first location only, so the store total equals the catalogue number.
      inventoryQuantities: locations.map((locationId, k) => ({ locationId, name: "available", quantity: k === 0 ? v.inventory : 0 })),
    })),
    files: uploads.map((u) => ({ originalSource: u.resourceUrl, contentType: "IMAGE", alt: u.alt, filename: u.filename })),
  };
}

async function createProduct(admin: AdminClient, input: ReturnType<typeof productSetInput>): Promise<CreatedProduct> {
  const { productSet } = await admin.query<{
    productSet: {
      product: {
        id: string;
        handle: string;
        variants: { nodes: { title: string; availableForSale: boolean }[] };
        media: { nodes: { id: string }[] };
      } | null;
      userErrors: (UserError & { code?: string })[];
    };
  }>(
    `mutation($input: ProductSetInput!) {
      productSet(input: $input, synchronous: true) {
        product {
          id
          handle
          variants(first: 100) { nodes { title availableForSale } }
          media(first: 20) { nodes { id } }
        }
        userErrors { field message code }
      }
    }`,
    { input }
  );
  assertNoUserErrors(`productSet ${input.handle}`, productSet.userErrors);
  if (!productSet.product) throw new Error(`productSet ${input.handle} returned no product`);
  const p = productSet.product;
  return { id: p.id, handle: p.handle, variants: p.variants.nodes, mediaCount: p.media.nodes.length };
}

// --- collections ---------------------------------------------------------------------

function collectionInput(collection: CatalogueCollection, seedTag: string, productIds: Map<string, string>) {
  const inclusion = collection.rule
    ? {
        matchType: "ALL",
        conditions: [{ productTag: { relation: "TAGGED_WITH", values: [collection.rule.tag], matchType: "ANY" } }],
      }
    : {
        selections: (collection.products ?? []).map((handle) => {
          const productId = productIds.get(handle);
          if (!productId) throw new Error(`collection "${collection.handle}": product "${handle}" was not created`);
          return { productId };
        }),
      };
  return {
    title: collection.title,
    handle: collection.handle,
    // Seeded in catalogue order, so oldest-first shows the catalogue order.
    sortOrder: collection.rule ? "CREATED" : "MANUAL",
    sources: [{ source: { title: `${collection.title} (${seedTag})`, targetType: "PRODUCTS", inclusion } }],
  };
}

async function createCollection(admin: AdminClient, input: ReturnType<typeof collectionInput>): Promise<{ id: string; handle: string }> {
  const { collectionCreate } = await admin.query<{
    collectionCreate: { collection: { id: string; handle: string } | null; userErrors: UserError[] };
  }>(
    `mutation($collection: CollectionCreateInput!) {
      collectionCreate(collection: $collection) { collection { id handle } userErrors { field message } }
    }`,
    { collection: input }
  );
  assertNoUserErrors(`collectionCreate ${input.handle}`, collectionCreate.userErrors);
  if (!collectionCreate.collection) throw new Error(`collectionCreate ${input.handle} returned no collection`);
  return collectionCreate.collection;
}

// --- publishing ------------------------------------------------------------------------

async function publicationIds(admin: AdminClient): Promise<string[]> {
  const { publications } = await admin.query<{ publications: { nodes: { id: string }[] } }>(
    `{ publications(first: 25) { nodes { id } } }`
  );
  return publications.nodes.map((p) => p.id);
}

/** Publishes to every sales channel, which is what the admin UI does for a new product. */
async function publish(admin: AdminClient, id: string, publications: string[]): Promise<void> {
  const { publishablePublish } = await admin.query<{ publishablePublish: { userErrors: UserError[] } }>(
    `mutation($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } }
    }`,
    { id, input: publications.map((publicationId) => ({ publicationId })) }
  );
  assertNoUserErrors(`publish ${id}`, publishablePublish.userErrors);
}

function publishInstructions(): string {
  return [
    `Products exist but are NOT visible to the storefront: publishing to the Headless`,
    `channel needs the ${PUBLISH_SCOPE} scope, which this app's token lacks.`,
    `  1. Open the app in the Shopify Dev Dashboard and edit its access scopes`,
    `  2. Add ${PUBLISH_SCOPE}, save, and re-install or update the app on the store if asked`,
    `  3. pnpm seed --check   (confirms the scope is on the token)`,
    `  4. pnpm seed           (re-seeds and publishes)`,
  ].join("\n");
}

// --- storefront check -------------------------------------------------------------------

type StorefrontProduct = { handle: string; availableForSale: boolean; images: { nodes: { url: string }[] } };

async function storefrontProducts(seedTag: string): Promise<StorefrontProduct[]> {
  const res = await fetch(`https://${env("SHOPIFY_STORE_DOMAIN")}/api/${env("SHOPIFY_API_VERSION")}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Shopify-Storefront-Private-Token": env("SHOPIFY_STOREFRONT_PRIVATE_TOKEN") },
    body: JSON.stringify({
      query: `query($q: String!) { products(first: 100, query: $q) { nodes { handle availableForSale images(first: 1) { nodes { url } } } } }`,
      variables: { q: `tag:${seedTag}` },
    }),
  });
  const json = (await res.json()) as { data?: { products: { nodes: StorefrontProduct[] } } };
  return json.data?.products.nodes ?? [];
}

// --- main -----------------------------------------------------------------------------------

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const { catalogue, warnings } = readCatalogue();
  for (const w of warnings) log(`warning: ${w}`);

  const products = flags.only ? catalogue.products.filter((p) => p.handle === flags.only) : catalogue.products;
  if (flags.only && !products.length) throw new Error(`no product "${flags.only}" in catalogue.json`);
  const variantCount = products.reduce((n, p) => n + expandVariants(p, catalogue.defaults).length, 0);
  const imageCount = products.reduce((n, p) => n + p.images.count, 0);
  log(`plan: ${products.length} product(s), ${variantCount} variant(s), ${imageCount} image(s), ${catalogue.collections.length} collection(s)`);

  if (flags.dryRun) {
    for (const p of products) {
      const variants = expandVariants(p, catalogue.defaults);
      log(`  ${p.handle}: ${variants.length} variant(s) ${variants.map((v) => `${v.title} $${v.price}${v.inventory ? "" : " sold-out"}`).join(" | ")}`);
    }
    return;
  }

  const admin = await adminClient();
  const missing = REQUIRED_SCOPES.filter((s) => !admin.scopes.includes(s));
  const canPublish = admin.scopes.includes(PUBLISH_SCOPE);

  if (flags.check) {
    log(`store: ${admin.domain} (API ${admin.version})`);
    log(`scopes: ${admin.scopes.join(", ")}`);
    log(`required: ${REQUIRED_SCOPES.join(", ")} → ${missing.length ? `MISSING ${missing.join(", ")}` : "ok"}`);
    log(`publish: ${PUBLISH_SCOPE} → ${canPublish ? "ok" : "MISSING (products would be created but stay invisible to the storefront)"}`);
    const seeded = await listProducts(admin, `tag:${catalogue.seedTag}`);
    const all = await listProducts(admin);
    log(`products in store: ${all.length}, seeded by this script: ${seeded.length}`);
    if (canPublish) log(`publications: ${(await publicationIds(admin)).length}`);
    process.exitCode = missing.length || !canPublish ? 2 : 0;
    return;
  }
  if (missing.length) throw new Error(`the Admin token lacks ${missing.join(", ")}; run pnpm seed --check`);

  const locations = await locationIds(admin);

  // 1. Wipe what this script seeded before. The tag search lags behind recent
  //    writes, so every catalogue handle is also looked up directly.
  const stale = new Map<string, ProductNode>();
  if (!flags.only) for (const p of await listProducts(admin, `tag:${catalogue.seedTag}`)) stale.set(p.id, p);
  for (const p of products) {
    const existing = await findProductByHandle(admin, p.handle);
    if (!existing) continue;
    if (!existing.tags.includes(catalogue.seedTag)) {
      throw new Error(`product "${p.handle}" exists but was not seeded by this script (no "${catalogue.seedTag}" tag); rename one or delete it in the admin`);
    }
    stale.set(existing.id, existing);
  }
  if (stale.size) log(`re-seeding: removing ${stale.size} product(s) from the previous seed run (they are re-created below)`);
  for (const p of stale.values()) {
    await deleteProduct(admin, p.id);
    log(`  removed previous seed copy: ${p.handle}`);
  }
  if (!flags.only) {
    for (const c of catalogue.collections) {
      const existing = await findCollection(admin, c.handle);
      if (existing) {
        await deleteCollection(admin, existing.id);
        log(`  removed previous collection: ${c.handle}`);
      }
    }
  }

  // 2. Products, with images uploaded first so productSet can attach them.
  const created = new Map<string, CreatedProduct>();
  for (const p of products) {
    const uploads = flags.skipImages ? [] : await uploadImages(admin, p);
    const result = await createProduct(admin, productSetInput(catalogue, p, locations, uploads));
    created.set(p.handle, result);
    const soldOut = result.variants.filter((v) => !v.availableForSale).length;
    log(`created ${p.handle}: ${result.variants.length} variant(s)${soldOut ? `, ${soldOut} sold out` : ""}, ${result.mediaCount} image(s)`);
  }

  // 3. Collections.
  const collections: { id: string; handle: string }[] = [];
  if (!flags.only) {
    const ids = new Map(Array.from(created, ([handle, p]) => [handle, p.id]));
    for (const c of catalogue.collections) {
      const result = await createCollection(admin, collectionInput(c, catalogue.seedTag, ids));
      collections.push(result);
      log(`created collection ${c.handle}${c.rule ? ` (tag:${c.rule.tag})` : ` (${c.products?.length} products)`}`);
    }
  }

  // 4. Publish to every sales channel, or say exactly why not.
  if (canPublish) {
    const publications = await publicationIds(admin);
    for (const p of created.values()) await publish(admin, p.id, publications);
    for (const c of collections) await publish(admin, c.id, publications);
    log(`published ${created.size} product(s) and ${collections.length} collection(s) to ${publications.length} publication(s)`);
  } else {
    log(publishInstructions());
  }

  // 5. Optionally clear Shopify's test data.
  if (flags.wipeOthers && !flags.only) {
    // Three independent checks, because the product listing can lag behind
    // writes: not created by this run, not a catalogue handle, not seed-tagged.
    const createdIds = new Set(Array.from(created.values(), (p) => p.id));
    const catalogueHandles = new Set(catalogue.products.map((p) => p.handle));
    const others = (await listProducts(admin)).filter(
      (p) => !createdIds.has(p.id) && !catalogueHandles.has(p.handle) && !p.tags.includes(catalogue.seedTag)
    );
    if (others.length) log(`--wipe-others: removing ${others.length} product(s) that are not part of the catalogue`);
    for (const p of others) {
      await deleteProduct(admin, p.id);
      log(`  removed test data: ${p.handle}`);
    }
  }

  // 6. What the store holds now, then what the storefront can see.
  const remaining = await listProducts(admin);
  const seeded = remaining.filter((p) => p.tags.includes(catalogue.seedTag)).length;
  log(`store now has ${remaining.length} product(s): ${seeded} seeded, ${remaining.length - seeded} other`);

  if (canPublish) {
    const expected = flags.only ? 1 : products.length;
    let visible: StorefrontProduct[] = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      visible = await storefrontProducts(catalogue.seedTag);
      if (visible.length >= expected) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    const withImages = visible.filter((p) => p.images.nodes.length).length;
    log(`storefront sees ${visible.length}/${expected} seeded product(s), ${withImages} with images`);
    if (visible.length < expected) process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
