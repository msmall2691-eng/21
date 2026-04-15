import { gql } from '@apollo/client';

export const GET_STR_PROPERTIES = gql`
  query GetStrProperties {
    properties {
      edges {
        node {
          id
          name
          propertyType
          icalSyncUrl {
            primaryLinkUrl
            primaryLinkLabel
            secondaryLinks {
              url
              label
            }
          }
          person {
            id
            name {
              firstName
              lastName
            }
          }
          company {
            id
            name
          }
        }
      }
      totalCount
    }
  }
`;
