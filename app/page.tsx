import { shopifyFetch } from "@/lib/shopify/client";

const QUERY = `
  query Products {
    products(first: 10) {
      nodes { id title handle }
    }
  }
`;

type ProductsResponse = {
  products: { nodes: { id: string; title: string; handle: string }[] };
};

export default async function Home() {
  const data = await shopifyFetch<ProductsResponse>(QUERY);

  return (
    <ul>
      {data.products.nodes.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  );
}
