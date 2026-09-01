import { shopifyFetch } from "@/lib/shopify/client";

const QUERY = `#graphql
  query Products {
    products(first: 10) {
      nodes { id title handle }
    }
  }
`;

export default async function Home() {
  const data = await shopifyFetch(QUERY);

  return (
    <ul>
      {data.products.nodes.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  );
}
