/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as StorefrontTypes from './storefront.types.js';

export type ProductsQueryVariables = StorefrontTypes.Exact<{ [key: string]: never; }>;


export type ProductsQuery = { products: { nodes: Array<Pick<StorefrontTypes.Product, 'id' | 'title' | 'handle'>> } };

export type ProductQueryVariables = StorefrontTypes.Exact<{
  handle: StorefrontTypes.Scalars['String']['input'];
}>;


export type ProductQuery = { product?: StorefrontTypes.Maybe<(
    Pick<StorefrontTypes.Product, 'id' | 'title' | 'descriptionHtml'>
    & { priceRange: { minVariantPrice: Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'>, maxVariantPrice: Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'> }, images: { nodes: Array<Pick<StorefrontTypes.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>> }, options: Array<(
      Pick<StorefrontTypes.ProductOption, 'id' | 'name'>
      & { optionValues: Array<Pick<StorefrontTypes.ProductOptionValue, 'id' | 'name'>> }
    )>, variants: { nodes: Array<(
        Pick<StorefrontTypes.ProductVariant, 'id' | 'title' | 'availableForSale'>
        & { price: Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'>, selectedOptions: Array<Pick<StorefrontTypes.SelectedOption, 'name' | 'value'>> }
      )> } }
  )> };

interface GeneratedQueryTypes {
  "#graphql\n  query Products {\n    products(first: 10) {\n      nodes { id title handle }\n    }\n  }\n": {return: ProductsQuery, variables: ProductsQueryVariables},
  "#graphql\n  query Product($handle: String!) {\n    product(handle: $handle) {\n      id\n      title\n      descriptionHtml\n      priceRange {\n        minVariantPrice { amount currencyCode }\n        maxVariantPrice { amount currencyCode }\n      }\n      images(first: 6) {\n        nodes { id url altText width height }\n      }\n      options {\n        id\n        name\n        optionValues { id name }\n      }\n      variants(first: 20) {\n        nodes {\n          id\n          title\n          availableForSale\n          price { amount currencyCode }\n          selectedOptions { name value }\n        }\n      }\n    }\n  }\n": {return: ProductQuery, variables: ProductQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@/lib/shopify/client' {
  type InputMaybe<T> = StorefrontTypes.InputMaybe<T>;
  interface StorefrontQueries extends GeneratedQueryTypes {}
  interface StorefrontMutations extends GeneratedMutationTypes {}
}
