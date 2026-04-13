import { gql, useQuery } from '@apollo/client';

const GET_QUOTE_QUERY = gql`
  query GetQuote($id: String!) {
    quote(id: $id) {
      id
      quoteNumber
      status
      personId
      opportunityId
      companyId
      serviceAddress
      serviceType
      frequency
      squareFeet
      bedrooms
      bathrooms
      lineItems
      subtotal
      discountTotal
      taxTotal
      total
      currency
      customerNotes
      internalNotes
      expiresAt
      createdAt
      updatedAt
      person {
        id
        name
        email
        phone
      }
      opportunity {
        id
        name
      }
      company {
        id
        name
      }
      attachments {
        edges {
          node {
            id
            fileName
            createdAt
          }
        }
      }
    }
  }
`;

export interface UseQuoteResult {
  quote?: any;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

export const useQuote = (quoteId: string): UseQuoteResult => {
  const { data, loading, error, refetch } = useQuery(GET_QUOTE_QUERY, {
    variables: { id: quoteId },
    skip: !quoteId,
  });

  return {
    quote: data?.quote,
    loading,
    error,
    refetch,
  };
};
