import { useQuery } from '@apollo/client';
import { GET_CALENDAR_WITH_CLEANINGS } from '@/calendar/graphql/queries/getCalendarWithCleanings';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useState } from 'react';
import styled from '@emotion/styled';

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  height: 100%;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 28px;
  font-weight: 600;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StatCard = styled.div`
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const StatLabel = styled.p`
  margin: 0 0 8px 0;
  font-size: 14px;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
`;

const Section = styled.div`
  margin-top: 24px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
`;

const PropertiesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
`;

const PropertyCard = styled.div`
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const PropertyName = styled.h3`
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const PropertyDetail = styled.p`
  margin: 8px 0;
  font-size: 14px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CleaningsList = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
`;

const CleaningItem = styled.div`
  padding: 8px 0;
  font-size: 13px;
  color: #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StatusBadge = styled.span<{ status?: string }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${(props) => {
    switch (props.status) {
      case 'SCHEDULED':
        return '#e3f2fd';
      case 'IN_PROGRESS':
        return '#fff3e0';
      case 'COMPLETED':
        return '#e8f5e9';
      default:
        return '#f5f5f5';
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case 'SCHEDULED':
        return '#1565c0';
      case 'IN_PROGRESS':
        return '#f57c00';
      case 'COMPLETED':
        return '#388e3c';
      default:
        return '#666';
    }
  }};
`;

const UpcomingCleanings = styled.div`
  margin-top: 24px;
`;

const CleaningRow = styled.div`
  padding: 16px;
  background: #fafafa;
  border-left: 4px solid #7b1fa2;
  border-radius: 4px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CleaningInfo = styled.div`
  flex: 1;
`;

const CleaningTime = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
`;

const CleaningDetails = styled.p`
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #666;
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
`;

const FilterButton = styled.button<{ active?: boolean }>`
  padding: 8px 16px;
  border: 1px solid ${(props) => (props.active ? '#667eea' : '#ddd')};
  background-color: ${(props) => (props.active ? '#667eea' : 'white')};
  color: ${(props) => (props.active ? 'white' : '#333')};
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    border-color: #667eea;
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

export const CleaningDashboardPage = () => {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [startDate] = useState(now.toISOString().split('T')[0]);
  const [endDate] = useState(sevenDaysLater.toISOString().split('T')[0]);
  const [filterByStatus, setFilterByStatus] = useState<string | null>(null);

  const { data, loading } = useQuery(GET_CALENDAR_WITH_CLEANINGS, {
    variables: {
      startDate: `${startDate}T00:00:00Z`,
      endDate: `${endDate}T23:59:59Z`,
      propertyIds: null,
    },
  });

  const events = data?.getCalendarWithCleanings?.events || [];
  const cleaningJobs = events.filter((e: any) => e.type === 'CLEANING_JOB');

  // Group cleanings by property
  const propertiesMap = new Map();
  cleaningJobs.forEach((job: any) => {
    if (!propertiesMap.has(job.propertyId)) {
      propertiesMap.set(job.propertyId, {
        id: job.propertyId,
        name: job.propertyName,
        address: job.propertyAddress,
        cleanings: [],
      });
    }
    propertiesMap.get(job.propertyId).cleanings.push(job);
  });

  const properties = Array.from(propertiesMap.values());

  // Calculate statistics
  const totalCleanings = cleaningJobs.length;
  const uniqueProperties = properties.length;
  const uniqueStaff = new Set(cleaningJobs.map((j: any) => j.assignedStaffName).filter(Boolean))
    .size;
  const scheduledCount = cleaningJobs.filter((j: any) => j.status === 'SCHEDULED').length;

  // Filter cleanings
  const filteredCleanings = filterByStatus
    ? cleaningJobs.filter((j: any) => j.status === filterByStatus)
    : cleaningJobs;

  const filteredProperties = properties.filter((p) =>
    p.cleanings.some((c: any) =>
      !filterByStatus ? true : c.status === filterByStatus,
    ),
  );

  return (
    <PageContainer>
      <DashboardContainer>
        <Header>
          <Title>🧹 Cleaning Schedule Dashboard</Title>
          <div>
            <span style={{ fontSize: '14px', color: '#666' }}>
              Next 7 days
            </span>
          </div>
        </Header>

        {loading ? (
          <LoadingContainer>Loading dashboard...</LoadingContainer>
        ) : (
          <>
            {/* Statistics Cards */}
            <StatsGrid>
              <StatCard style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <StatLabel>Upcoming Cleanings</StatLabel>
                <StatValue>{totalCleanings}</StatValue>
              </StatCard>
              <StatCard style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                <StatLabel>Properties</StatLabel>
                <StatValue>{uniqueProperties}</StatValue>
              </StatCard>
              <StatCard style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                <StatLabel>Staff Members</StatLabel>
                <StatValue>{uniqueStaff}</StatValue>
              </StatCard>
              <StatCard style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
                <StatLabel>Scheduled</StatLabel>
                <StatValue>{scheduledCount}</StatValue>
              </StatCard>
            </StatsGrid>

            {/* Filter by Status */}
            <FilterContainer>
              <FilterButton
                active={filterByStatus === null}
                onClick={() => setFilterByStatus(null)}
              >
                All ({totalCleanings})
              </FilterButton>
              <FilterButton
                active={filterByStatus === 'SCHEDULED'}
                onClick={() => setFilterByStatus('SCHEDULED')}
              >
                Scheduled ({cleaningJobs.filter((j: any) => j.status === 'SCHEDULED').length})
              </FilterButton>
              <FilterButton
                active={filterByStatus === 'IN_PROGRESS'}
                onClick={() => setFilterByStatus('IN_PROGRESS')}
              >
                In Progress ({cleaningJobs.filter((j: any) => j.status === 'IN_PROGRESS').length})
              </FilterButton>
              <FilterButton
                active={filterByStatus === 'COMPLETED'}
                onClick={() => setFilterByStatus('COMPLETED')}
              >
                Completed ({cleaningJobs.filter((j: any) => j.status === 'COMPLETED').length})
              </FilterButton>
            </FilterContainer>

            {/* Upcoming Cleanings List */}
            <UpcomingCleanings>
              <SectionTitle>📅 Upcoming Cleanings (sorted by date)</SectionTitle>
              {filteredCleanings.length === 0 ? (
                <LoadingContainer style={{ height: 'auto', padding: '40px' }}>
                  No cleanings found for this filter
                </LoadingContainer>
              ) : (
                filteredCleanings
                  .sort(
                    (a: any, b: any) =>
                      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
                  )
                  .map((cleaning: any) => (
                    <CleaningRow key={cleaning.id}>
                      <CleaningInfo>
                        <CleaningTime>
                          {new Date(cleaning.startsAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </CleaningTime>
                        <CleaningDetails>
                          {cleaning.propertyName} • {cleaning.assignedStaffName || 'Unassigned'}
                        </CleaningDetails>
                      </CleaningInfo>
                      <StatusBadge status={cleaning.status}>
                        {cleaning.status || 'UNKNOWN'}
                      </StatusBadge>
                    </CleaningRow>
                  ))
              )}
            </UpcomingCleanings>

            {/* Properties Grid */}
            <Section>
              <SectionTitle>🏠 Properties with Cleanings</SectionTitle>
              <PropertiesGrid>
                {filteredProperties.map((property) => (
                  <PropertyCard key={property.id}>
                    <PropertyName>{property.name}</PropertyName>
                    <PropertyDetail>📍 {property.address || 'No address'}</PropertyDetail>
                    <PropertyDetail>
                      🧹 {property.cleanings.length} cleaning
                      {property.cleanings.length !== 1 ? 's' : ''}
                    </PropertyDetail>

                    <CleaningsList>
                      {property.cleanings.map((cleaning: any) => (
                        <CleaningItem key={cleaning.id}>
                          <span>
                            {new Date(cleaning.startsAt).toLocaleDateString()}{' '}
                            {new Date(cleaning.startsAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <StatusBadge status={cleaning.status}>
                            {cleaning.status || 'UNKNOWN'}
                          </StatusBadge>
                        </CleaningItem>
                      ))}
                    </CleaningsList>
                  </PropertyCard>
                ))}
              </PropertiesGrid>
            </Section>
          </>
        )}
      </DashboardContainer>
    </PageContainer>
  );
};
