/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as StorefrontTypes from './storefront.types.js';

export type ProductsQueryVariables = StorefrontTypes.Exact<{ [key: string]: never; }>;


export type ProductsQuery = { products: { nodes: Array<Pick<StorefrontTypes.Product, 'id' | 'title' | 'handle'>> } };

export type ProductQueryVariables = StorefrontTypes.Exact<{
  handle: StorefrontTypes.Scalars['String']['input'];
  selectedOptions?: StorefrontTypes.InputMaybe<Array<StorefrontTypes.SelectedOptionInput> | StorefrontTypes.SelectedOptionInput>;
}>;


export type ProductQuery = { product?: StorefrontTypes.Maybe<(
    Pick<StorefrontTypes.Product, 'id' | 'title' | 'descriptionHtml'>
    & { priceRange: { minVariantPrice: Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'>, maxVariantPrice: Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'> }, images: { nodes: Array<Pick<StorefrontTypes.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>> }, options: Array<(
      Pick<StorefrontTypes.ProductOption, 'id' | 'name'>
      & { optionValues: Array<Pick<StorefrontTypes.ProductOptionValue, 'id' | 'name'>> }
    )>, variantsCount?: StorefrontTypes.Maybe<Pick<StorefrontTypes.Count, 'count'>>, variants: { nodes: Array<(
        Pick<StorefrontTypes.ProductVariant, 'id' | 'title' | 'availableForSale'>
        & { price: Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'>, compareAtPrice?: StorefrontTypes.Maybe<Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'>>, selectedOptions: Array<Pick<StorefrontTypes.SelectedOption, 'name' | 'value'>> }
      )> }, selectedOrFirstAvailableVariant?: StorefrontTypes.Maybe<(
      Pick<StorefrontTypes.ProductVariant, 'id' | 'title' | 'availableForSale'>
      & { price: Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'>, compareAtPrice?: StorefrontTypes.Maybe<Pick<StorefrontTypes.MoneyV2, 'amount' | 'currencyCode'>>, selectedOptions: Array<Pick<StorefrontTypes.SelectedOption, 'name' | 'value'>> }
    )> }
  )> };

interface GeneratedQueryTypes {
  "#graphql\n  query Products {\n    products(first: 10) {\n      nodes { id title handle }\n    }\n  }\n": {return: ProductsQuery, variables: ProductsQueryVariables},
  "#graphql\n  query Product($handle: String!, $selectedOptions: [SelectedOptionInput!]) {\n    product(handle: $handle) {\n      id\n      title\n      descriptionHtml\n      priceRange {\n        minVariantPrice { amount currencyCode }\n        maxVariantPrice { amount currencyCode }\n      }\n      images(first: 6) {\n        nodes { id url altText width height }\n      }\n      options {\n        id\n        name\n        optionValues { id name }\n      }\n      variantsCount { count }\n      variants(first: 20) {\n        nodes {\n          id\n          title\n          availableForSale\n          price { amount currencyCode }\n          compareAtPrice { amount currencyCode }\n          selectedOptions { name value }\n        }\n      }\n      selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions) {\n        id\n        title\n        availableForSale\n        price { amount currencyCode }\n        compareAtPrice { amount currencyCode }\n        selectedOptions { name value }\n      }\n    }\n  }\n": {return: ProductQuery, variables: ProductQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@/lib/shopify/client' {
  type InputMaybe<T> = StorefrontTypes.InputMaybe<T>;
  interface StorefrontQueries extends GeneratedQueryTypes {}
  interface StorefrontMutations extends GeneratedMutationTypes {}
}
