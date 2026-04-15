import { gql } from '@apollo/client';

export const GET_JOB_VISITS_WITH_SYNC_STATUS = gql`
  query GetJobVisitsWithSyncStatus {
    jobVisits {
      edges {
        node {
          id
          name
          scheduledDate
          completedDate
          status
          duration
          notes
          checklistCompleted
          position
          calendarEventId
          property {
            id
            name
            propertyType
            address
          }
          staffMember {
            id
            name
          }
          calendarEvent {
            id
            title
            startsAt
            endsAt
            location
            description
          }
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;
