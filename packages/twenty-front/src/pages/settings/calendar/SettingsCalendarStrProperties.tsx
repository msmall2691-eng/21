import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { H2Title } from 'twenty-ui/display';
import { Section } from 'twenty-ui/layout';
import { StrPropertiesDashboard } from '@/calendar/components/str-properties-dashboard.component';
import { StrWorkflowNav } from '@/calendar/components/str-workflow-nav.component';

const StyledContainer = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
  align-items: start;
  margin-top: 2rem;
`;

const StyledMainContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

/**
 * Settings page for managing STR (Short-Term Rental) properties and iCal feeds.
 *
 * Users can:
 * 1. View all STR properties
 * 2. Add/edit iCal feed URLs (Airbnb, VRBO, Booking.com)
 * 3. Trigger manual sync
 * 4. See sync history and status
 *
 * Workflow:
 * - iCal feeds are fetched every 6 hours automatically
 * - Checkout events trigger JobVisit creation
 * - JobVisits sync to Google Calendar
 * - Team can then complete jobs and trigger invoicing
 */
export const SettingsCalendarStrProperties = () => {
  const { t } = useLingui();

  return (
    <SubMenuTopBarContainer
      title={t`STR Properties`}
      links={[
        {
          children: t`Settings`,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: t`STR Properties` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title title={t`Configure iCal Feeds`} />
          <p className="mb-6 text-sm text-gray-600">
            Add iCal feed URLs from your property management system (Airbnb,
            VRBO, Booking.com, etc.) to automatically create cleaning jobs when
            guests check out.
          </p>

          <StyledContainer>
            <StrWorkflowNav activeSection="properties" />

            <StyledMainContent>
              <StrPropertiesDashboard />

              <div className="mt-8 rounded bg-blue-50 p-4 text-sm text-blue-900">
                <h3 className="font-semibold">How it works:</h3>
                <ol className="mt-2 space-y-1 pl-4">
                  <li>
                    1. Add the iCal feed URL from your PMS (copy the "Subscribe
                    to calendar" link)
                  </li>
                  <li>
                    2. System automatically checks for new checkout events every
                    6 hours
                  </li>
                  <li>
                    3. Cleaning jobs are created and synced to Google Calendar
                  </li>
                  <li>
                    4. Your team sees all jobs in one place and can track
                    progress
                  </li>
                  <li>
                    5. Jobs automatically generate invoices when completed
                  </li>
                </ol>
              </div>
            </StyledMainContent>
          </StyledContainer>
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
