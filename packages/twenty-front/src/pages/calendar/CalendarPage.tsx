import { useQuery } from '@apollo/client/react';
import { GET_CALENDAR_WITH_CLEANINGS } from '@/calendar/graphql/queries/getCalendarWithCleanings';
import { GET_JOB_VISITS_WITH_SYNC_STATUS } from '@/calendar/graphql/queries/getJobVisitsWithSyncStatus';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useState, useEffect } from 'react';
import { styled } from '@linaria/react';

type CalendarEvent = {
  id: string;
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  isCanceled: boolean;
  isFullDay: boolean;
  type: 'CALENDAR_EVENT' | 'CLEANING_JOB';
  cleaningId?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  propertyAddress?: string | null;
  guestNote?: string | null;
  assignedStaffName?: string | null;
  status?: string | null;
  serviceAgreementId?: string | null;
};

type JobVisit = {
  id: string;
  name: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  status: string | null;
  duration: number | null;
  notes: string | null;
  checklistCompleted: boolean;
  calendarEventId: string | null;
  property: {
    id: string;
    name: string | null;
    address: string | null;
  } | null;
  staffMember: {
    id: string;
    name: string | null;
  } | null;
  calendarEvent: {
    id: string;
    title: string | null;
    startsAt: string | null;
    endsAt: string | null;
    location: string | null;
    description: string | null;
  } | null;
};

type CalendarWithCleaningsResponse = {
  getCalendarWithCleanings: {
    events: CalendarEvent[];
    totalCount: number;
    startDate: string;
    endDate: string;
  };
};

type JobVisitsResponse = {
  jobVisits: {
    edges: Array<{ node: JobVisit }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    totalCount: number;
  };
};

const CalendarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  height: 100%;
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
`;

const Button = styled.button`
  padding: 8px 16px;
  background-color: #1565c0;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background-color: #1565c0aa;
  }
`;

const EventsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EventCard = styled.div<{ type?: 'CALENDAR_EVENT' | 'CLEANING_JOB' }>`
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: ${(props) =>
    props.type === 'CALENDAR_EVENT' ? '#e3f2fd' : '#f3e5f5'};
  cursor: pointer;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const EventTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
`;

const EventDetail = styled.p`
  margin: 4px 0;
  font-size: 13px;
  color: #666;
`;

const Badge = styled.span<{ type?: 'CALENDAR_EVENT' | 'CLEANING_JOB' | 'JOB_VISIT' }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${(props) => {
    switch (props.type) {
      case 'CALENDAR_EVENT': return '#1565c0';
      case 'CLEANING_JOB': return '#7b1fa2';
      case 'JOB_VISIT': return '#f57c00';
      default: return '#616161';
    }
  }};
  color: white;
  margin-bottom: 8px;
`;

const SyncStatusIndicator = styled.span<{ synced: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${(props) => props.synced ? '#c8e6c9' : '#fff9c4'};
  color: ${(props) => props.synced ? '#2e7d32' : '#f57f17'};
  margin-bottom: 8px;
`;

const SyncIndicatorDot = styled.span<{ synced: boolean }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${(props) => props.synced ? '#2e7d32' : '#f57f17'};
  animation: ${(props) => props.synced ? 'none' : 'pulse 2s infinite'};

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  font-size: 16px;
  color: #999;
`;

const ErrorContainer = styled.div`
  padding: 16px;
  background-color: #ffebee;
  border: 1px solid #ef5350;
  border-radius: 4px;
  color: #d32f2f;
`;

export const CalendarPage = () => {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(oneMonthAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(oneMonthLater.toISOString().split('T')[0]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const startDateISO = `${startDate}T00:00:00Z`;
  const endDateISO = `${endDate}T23:59:59Z`;

  const { data, loading, error, refetch } = useQuery<CalendarWithCleaningsResponse>(
    GET_CALENDAR_WITH_CLEANINGS,
    {
      variables: {
        startDate: startDateISO,
        endDate: endDateISO,
        propertyIds: null,
      },
    },
  );

  const {
    data: jobVisitsData,
    loading: jobVisitsLoading,
    error: jobVisitsError,
    refetch: refetchJobVisits,
  } = useQuery<JobVisitsResponse>(GET_JOB_VISITS_WITH_SYNC_STATUS);

  // Auto-refresh every 30 seconds for live sync status
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetchJobVisits();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, refetchJobVisits]);

  const handleDateChange = () => {
    refetch({
      startDate: startDateISO,
      endDate: endDateISO,
    });
    refetchJobVisits();
  };

  const events = data?.getCalendarWithCleanings?.events || [];

  // Filter JobVisits by date range on frontend
  const startDateMs = new Date(startDateISO).getTime();
  const endDateMs = new Date(endDateISO).getTime();
  const allJobVisits = jobVisitsData?.jobVisits?.edges?.map((edge) => edge.node) || [];
  const jobVisits = allJobVisits.filter((job) => {
    if (!job.scheduledDate) return false;
    const jobTime = new Date(job.scheduledDate).getTime();
    return jobTime >= startDateMs && jobTime <= endDateMs;
  });
  const allItems = [
    ...events.map((event) => ({
      id: event.id,
      type: event.type as 'CALENDAR_EVENT' | 'CLEANING_JOB',
      title: event.title,
      startTime: event.startsAt,
      endTime: event.endsAt,
      location: event.location,
      description: event.description,
      propertyName: event.propertyName,
      propertyAddress: event.propertyAddress,
      guestNote: event.guestNote,
      assignedStaffName: event.assignedStaffName,
      status: event.status,
      isCanceled: event.isCanceled,
      syncStatus: 'synced' as const,
    })),
    ...jobVisits.map((job) => ({
      id: job.id,
      type: 'JOB_VISIT' as const,
      title: job.name || 'Untitled Job Visit',
      startTime: job.scheduledDate,
      endTime: job.completedDate,
      location: job.property?.address || null,
      description: job.notes || null,
      propertyName: job.property?.name || null,
      propertyAddress: job.property?.address || null,
      guestNote: job.notes || null,
      assignedStaffName: job.staffMember?.name || null,
      status: job.status,
      isSynced: !!job.calendarEventId,
      syncStatus: job.calendarEventId ? 'synced' : 'pending' as const,
      calendarEventId: job.calendarEventId,
      jobVisitId: job.id,
    })),
  ].sort((a, b) => {
    const timeA = new Date(a.startTime || 0).getTime();
    const timeB = new Date(b.startTime || 0).getTime();
    return timeA - timeB;
  });

  return (
    <PageContainer>
      <CalendarContainer>
        <h1>Calendar & Cleaning Schedule</h1>

        <ControlsContainer>
          <div>
            <label>From: </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label>To: </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
            />
          </div>
          <Button onClick={handleDateChange}>Load Events</Button>
          <Button
            style={{
              backgroundColor: autoRefresh ? '#4caf50' : '#999',
              marginLeft: 'auto',
            }}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '🔄 Live Sync ON' : '⏸ Live Sync OFF'}
          </Button>
        </ControlsContainer>

        {(error || jobVisitsError) && (
          <ErrorContainer>
            {error && `Error loading events: ${error.message}`}
            {jobVisitsError && `Error loading job visits: ${jobVisitsError.message}`}
          </ErrorContainer>
        )}

        {(loading || jobVisitsLoading) && (
          <LoadingContainer>Loading calendar...</LoadingContainer>
        )}

        {!loading && !jobVisitsLoading && (
          <>
            <div>
              Showing {allItems.length} item
              {allItems.length !== 1 ? 's' : ''} ({events.length} calendar event
              {events.length !== 1 ? 's' : ''}, {jobVisits.length} job visit
              {jobVisits.length !== 1 ? 's' : ''})
            </div>

            <EventsContainer>
              {allItems.length === 0 ? (
                <LoadingContainer>No events found for this date range</LoadingContainer>
              ) : (
                allItems.map((item: any) => (
                  <EventCard
                    key={item.id}
                    type={item.type === 'JOB_VISIT' ? undefined : (item.type as 'CALENDAR_EVENT' | 'CLEANING_JOB')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <Badge type={item.type}>
                          {item.type === 'CALENDAR_EVENT'
                            ? '📅 Calendar Event'
                            : item.type === 'CLEANING_JOB'
                              ? '🧹 Cleaning Job'
                              : '📍 Job Visit'}
                        </Badge>
                      </div>
                      {item.type === 'JOB_VISIT' && (
                        <SyncStatusIndicator synced={item.isSynced}>
                          <SyncIndicatorDot synced={item.isSynced} />
                          {item.isSynced ? '✓ Synced' : '⏳ Pending'}
                        </SyncStatusIndicator>
                      )}
                    </div>
                    <EventTitle>{item.title}</EventTitle>

                    {item.startTime && (
                      <EventDetail>
                        📅 {new Date(item.startTime).toLocaleString()}
                      </EventDetail>
                    )}

                    {item.location && (
                      <EventDetail>📍 {item.location}</EventDetail>
                    )}

                    {item.description && (
                      <EventDetail>💬 {item.description}</EventDetail>
                    )}

                    {(item.type === 'CLEANING_JOB' || item.type === 'JOB_VISIT') && (
                      <>
                        {item.propertyName && (
                          <EventDetail>🏠 Property: {item.propertyName}</EventDetail>
                        )}
                        {item.assignedStaffName && (
                          <EventDetail>👤 Staff: {item.assignedStaffName}</EventDetail>
                        )}
                        {item.status && (
                          <EventDetail>Status: {item.status}</EventDetail>
                        )}
                      </>
                    )}
                  </EventCard>
                ))
              )}
            </EventsContainer>
          </>
        )}
      </CalendarContainer>
    </PageContainer>
  );
};
