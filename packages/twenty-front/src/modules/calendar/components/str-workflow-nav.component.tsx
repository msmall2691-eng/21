import { useNavigate } from 'react-router-dom';

type StrWorkflowNavProps = {
  activeSection?: 'properties' | 'schedule' | 'calendar' | 'invoices';
};

/**
 * Navigation menu for the STR workflow.
 *
 * Shows the complete flow:
 * 1. Properties (configure iCal feeds)
 * 2. Schedule (view JobVisits by type)
 * 3. Calendar (Google Calendar view)
 * 4. Invoices (auto-drafted invoices from completed jobs)
 *
 * Used in sidebar or as breadcrumb navigation.
 */
export const StrWorkflowNav = ({
  activeSection,
}: StrWorkflowNavProps) => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'properties',
      label: 'STR Properties',
      icon: '🏠',
      description: 'Configure iCal feeds',
      path: '/settings/calendar/str-properties',
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: '📅',
      description: 'View jobs by type',
      path: '/calendar/schedule',
    },
    {
      id: 'calendar',
      label: 'Google Calendar',
      icon: '📆',
      description: 'Full calendar view',
      path: '/calendar',
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: '💰',
      description: 'Completed jobs',
      path: '/invoices',
    },
  ];

  return (
    <div className="rounded border border-gray-300 bg-white p-4">
      <h3 className="mb-4 text-sm font-semibold">STR Workflow</h3>

      <div className="space-y-2">
        {sections.map((section, index) => (
          <div key={section.id}>
            <button
              onClick={() => navigate(section.path)}
              className={`w-full rounded px-3 py-2 text-left text-sm transition ${
                activeSection === section.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-base">{section.icon}</span>
                <div>
                  <div className="font-medium">{section.label}</div>
                  <div className="text-xs text-gray-600">{section.description}</div>
                </div>
              </div>
            </button>

            {index < sections.length - 1 && (
              <div className="mx-3 my-1 border-l-2 border-gray-300 py-1 pl-4 text-xs text-gray-500">
                ↓
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded bg-green-50 p-3 text-xs text-green-700">
        <div className="font-semibold">Complete Workflow</div>
        <ol className="mt-2 space-y-1 pl-4">
          <li>1. Set up iCal feed in Properties</li>
          <li>2. System auto-creates JobVisits (6h or manual)</li>
          <li>3. JobVisits sync to Google Calendar</li>
          <li>4. Team marks jobs complete in Calendar</li>
          <li>5. Invoices auto-drafted for customers</li>
          <li>6. Email/SMS notifications sent</li>
        </ol>
      </div>
    </div>
  );
};
