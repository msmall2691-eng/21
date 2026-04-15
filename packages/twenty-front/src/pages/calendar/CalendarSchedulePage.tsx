import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { JobVisitsListWithTypes } from '@/calendar/components/job-visits-list-with-types.component';
import { GET_JOB_VISITS_WITH_SYNC_STATUS } from '@/calendar/graphql/queries/getJobVisitsWithSyncStatus';
import { useMyConnectedAccounts } from '@/settings/accounts/hooks/useMyConnectedAccounts';
import { StrWorkflowNav } from '@/calendar/components/str-workflow-nav.component';
import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useMemo } from 'react';

const StyledPageHeader = styled.div`
  margin-bottom: 2rem;
`;

const StyledPageTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const StyledPageDescription = styled.p`
  font-size: 0.875rem;
  color: #666;
`;

const StyledContainer = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
  align-items: start;
`;

const StyledMainContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const StyledPropertyTypeList = styled.div`
  margin-top: 2rem;
  display: space-y-4;
`;

const StyledPropertyTypeItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const StyledPropertyTypeIcon = styled.span`
  font-size: 1.5rem;
`;

const StyledPropertyTypeInfo = styled.div`
`;

const StyledPropertyTypeTitle = styled.h3`
  font-weight: 600;
  margin-bottom: 0.25rem;
`;

const StyledPropertyTypeDescription = styled.p`
  font-size: 0.875rem;
  color: #666;
`;

const StyledInfoBox = styled.div`
  margin-top: 2rem;
  border-radius: 0.5rem;
  background: #f0fdf4;
  padding: 1rem;
  font-size: 0.875rem;
  color: #166534;
`;

const StyledInfoBoxTitle = styled.h3`
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

/**
 * Calendar schedule page showing all JobVisits organized by property type.
 *
 * Displays:
 * - STR (Short-Term Rental) cleanings in purple
 * - Residential cleanings in blue
 * - Commercial cleanings in orange
 *
 * Each job shows:
 * - Property name
 * - Scheduled date
 * - Status (Scheduled, In Progress, Completed)
 * - Calendar sync status (synced to Google Calendar or pending)
 *
 * Team can:
 * - Click to see full details
 * - Update status
 * - See customer information
 */
export const CalendarSchedulePage = () => {
  const { data, loading, error, refetch } = useQuery<{
    jobVisits: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          scheduledDate: string;
          completedDate: string | null;
          status: string;
          calendarEventId: string | null;
          property: {
            id: string;
            name: string;
            propertyType: string | null;
          } | null;
          calendarEvent: {
            id: string;
            title: string;
          } | null;
        };
      }>;
    };
  }>(GET_JOB_VISITS_WITH_SYNC_STATUS);
  const { accounts: connectedAccounts } = useMyConnectedAccounts();

  const jobVisits = useMemo(
    () => data?.jobVisits?.edges?.map((edge) => edge.node) ?? [],
    [data],
  );

  const googleCalendarConnected = connectedAccounts.some(
    (account) => account.provider === 'google',
  );
  const syncedVisits = jobVisits.filter((visit) => visit.calendarEventId).length;
  const pendingVisits = Math.max(jobVisits.length - syncedVisits, 0);

  return (
    <PageContainer>
      <StyledPageHeader>
        <StyledPageTitle>Schedule</StyledPageTitle>
        <StyledPageDescription>
          View all scheduled cleaning jobs organized by property type. Jobs
          are automatically created from iCal feeds and synced to Google
          Calendar.
        </StyledPageDescription>
      </StyledPageHeader>

      <StyledContainer>
        <StrWorkflowNav activeSection="schedule" />

        <StyledMainContent>
          <div className="rounded border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">Google Calendar Sync</h2>
              <button
                onClick={() => {
                  void refetch();
                }}
                className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
            <p className="text-sm text-gray-600">
              {googleCalendarConnected
                ? '✅ Google Calendar account connected. Job visits sync every 30 minutes.'
                : '⚠️ No Google Calendar account connected yet. Go to Settings → Accounts to connect Google.'}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Synced: {syncedVisits} · Pending: {pendingVisits}
            </p>
          </div>

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-700">
              Failed to load JobVisits: {error.message}
            </div>
          )}

          {loading && (
            <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">
              Loading schedule...
            </div>
          )}

          <JobVisitsListWithTypes jobVisits={jobVisits} />

          <StyledPropertyTypeList>
            <StyledPropertyTypeItem>
              <StyledPropertyTypeIcon>🟣</StyledPropertyTypeIcon>
              <StyledPropertyTypeInfo>
                <StyledPropertyTypeTitle>STR Properties</StyledPropertyTypeTitle>
                <StyledPropertyTypeDescription>
                  Short-term rental turnovers. Jobs created from iCal feeds
                  (Airbnb, VRBO, etc.)
                </StyledPropertyTypeDescription>
              </StyledPropertyTypeInfo>
            </StyledPropertyTypeItem>

            <StyledPropertyTypeItem>
              <StyledPropertyTypeIcon>🔵</StyledPropertyTypeIcon>
              <StyledPropertyTypeInfo>
                <StyledPropertyTypeTitle>Residential</StyledPropertyTypeTitle>
                <StyledPropertyTypeDescription>
                  Regular residential cleaning appointments
                </StyledPropertyTypeDescription>
              </StyledPropertyTypeInfo>
            </StyledPropertyTypeItem>

            <StyledPropertyTypeItem>
              <StyledPropertyTypeIcon>🟠</StyledPropertyTypeIcon>
              <StyledPropertyTypeInfo>
                <StyledPropertyTypeTitle>Commercial</StyledPropertyTypeTitle>
                <StyledPropertyTypeDescription>
                  Commercial building and office cleaning
                </StyledPropertyTypeDescription>
              </StyledPropertyTypeInfo>
            </StyledPropertyTypeItem>
          </StyledPropertyTypeList>

          <StyledInfoBox>
            <StyledInfoBoxTitle>Sync Status:</StyledInfoBoxTitle>
            <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem' }}>
              <li>📅 Synced = Job is in Google Calendar</li>
              <li>⏱️ Pending = Waiting to sync to Google Calendar</li>
              <li>💬 Customers with shared calendar access can see their jobs</li>
            </ul>
          </StyledInfoBox>
        </StyledMainContent>
      </StyledContainer>
    </PageContainer>
  );
};
