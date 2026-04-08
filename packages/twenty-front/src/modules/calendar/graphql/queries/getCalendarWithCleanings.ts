import { gql } from '@apollo/client';

export const GET_CALENDAR_WITH_CLEANINGS = gql`
  query GetCalendarWithCleanings(
    $startDate: String!
    $endDate: String!
    $propertyIds: [String!]
  ) {
    getCalendarWithCleanings(
      startDate: $startDate
      endDate: $endDate
      propertyIds: $propertyIds
    ) {
      events {
        id
        title
        startsAt
        endsAt
        location
        description
        isCanceled
        isFullDay
        type
        cleaningId
        propertyId
        propertyName
        propertyAddress
        guestNote
        assignedStaffName
        status
        serviceAgreementId
      }
      totalCount
      startDate
      endDate
    }
  }
`;
