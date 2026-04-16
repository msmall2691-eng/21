import { gql } from '@apollo/client';

export const GET_MESSAGES_FOR_USER = gql`
  query GetMessagesForUser(
    $workspaceId: String!
    $limit: Int
    $offset: Int
    $folder: String
  ) {
    messageThreads(
      filter: {
        workspaceId: { eq: $workspaceId }
        folder: { eq: $folder }
      }
      first: $limit
      after: $offset
      orderBy: { receivedAt: DESC }
    ) {
      edges {
        node {
          id
          externalThreadId
          subject
          lastMessageReceivedAt
          messageCount
          participants {
            id
            email
            displayName
          }
          messages(first: 1, orderBy: { receivedAt: DESC }) {
            edges {
              node {
                id
                text
                receivedAt
                direction
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;
