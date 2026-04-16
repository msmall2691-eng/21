import { gql } from '@apollo/client';

export const SCHEDULE_EMAIL = gql`
  mutation ScheduleEmail(
    $to: String!
    $subject: String!
    $body: String!
    $connectedAccountId: String!
    $scheduledAt: DateTime!
    $inReplyTo: String
  ) {
    scheduleEmail(
      input: {
        to: $to
        subject: $subject
        body: $body
        connectedAccountId: $connectedAccountId
        scheduledAt: $scheduledAt
        inReplyTo: $inReplyTo
      }
    ) {
      success
      jobId
      error
    }
  }
`;
