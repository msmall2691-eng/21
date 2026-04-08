import { useQuery } from '@apollo/client';
import { GET_CALENDAR_WITH_CLEANINGS } from '@/calendar/graphql/queries/getCalendarWithCleanings';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useState } from 'react';
import styled from '@emotion/styled';

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

const EventCard = styled.div<{ type: 'CALENDAR_EVENT' | 'CLEANING_JOB' }>`
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

const Badge = styled.span<{ type: 'CALENDAR_EVENT' | 'CLEANING_JOB' }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${(props) =>
    props.type === 'CALENDAR_EVENT' ? '#1565c0' : '#7b1fa2'};
  color: white;
  margin-bottom: 8px;
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

  const { data, loading, error, refetch } = useQuery(GET_CALENDAR_WITH_CLEANINGS, {
    variables: {
      startDate: `${startDate}T00:00:00Z`,
      endDate: `${endDate}T23:59:59Z`,
      propertyIds: null,
    },
  });

  const handleDateChange = () => {
    refetch({
      startDate: `${startDate}T00:00:00Z`,
      endDate: `${endDate}T23:59:59Z`,
    });
  };

  const events = data?.getCalendarWithCleanings?.events || [];

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
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label>To: </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button onClick={handleDateChange}>Load Events</Button>
        </ControlsContainer>

        {error && (
          <ErrorContainer>
            Error loading events: {error.message}
          </ErrorContainer>
        )}

        {loading && <LoadingContainer>Loading events...</LoadingContainer>}

        {!loading && (
          <>
            <div>
              Showing {events.length} event{events.length !== 1 ? 's' : ''} (
              {data?.getCalendarWithCleanings?.totalCount || 0} total)
            </div>

            <EventsContainer>
              {events.length === 0 ? (
                <LoadingContainer>No events found for this date range</LoadingContainer>
              ) : (
                events.map((event: any) => (
                  <EventCard key={event.id} type={event.type}>
                    <Badge type={event.type}>
                      {event.type === 'CALENDAR_EVENT'
                        ? '📅 Calendar Event'
                        : '🧹 Cleaning Job'}
                    </Badge>
                    <EventTitle>{event.title}</EventTitle>

                    {event.startsAt && (
                      <EventDetail>
                        📅 {new Date(event.startsAt).toLocaleString()}
                      </EventDetail>
                    )}

                    {event.location && (
                      <EventDetail>📍 {event.location}</EventDetail>
                    )}

                    {event.description && (
                      <EventDetail>💬 {event.description}</EventDetail>
                    )}

                    {event.type === 'CLEANING_JOB' && (
                      <>
                        {event.propertyName && (
                          <EventDetail>🏠 Property: {event.propertyName}</EventDetail>
                        )}
                        {event.assignedStaffName && (
                          <EventDetail>👤 Staff: {event.assignedStaffName}</EventDetail>
                        )}
                        {event.status && (
                          <EventDetail>Status: {event.status}</EventDetail>
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
