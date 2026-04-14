/**
 * Jobber-Style Navigation Setup
 *
 * Configures the workspace navigation menu to follow Jobber workflow:
 * Schedule → Jobs → Properties → Customers → Team → Settings
 *
 * This is the recommended navigation order for cleaning/field service businesses.
 * Can be customized per workspace based on settings.
 */

export const JOBBER_STYLE_NAVIGATION_CONFIG = {
  // Primary workflow items (main navigation)
  primary: [
    {
      position: 1,
      label: 'Dashboard',
      icon: 'IconLayoutDashboard',
      type: 'VIEW',
      objectName: 'dashboard',
    },
    {
      position: 2,
      label: 'Schedule',
      icon: 'IconCalendar',
      type: 'OBJECT',
      objectName: 'calendar', // Maps to calendar page
      description: 'View and manage your schedule',
      isPrimary: true,
    },
    {
      position: 3,
      label: 'JobVisits',
      icon: 'IconChecklist',
      type: 'OBJECT',
      objectName: 'jobVisit',
      description: 'Jobs and cleaning visits',
      isPrimary: true,
    },
    {
      position: 4,
      label: 'Properties',
      icon: 'IconHome',
      type: 'OBJECT',
      objectName: 'property',
      description: 'Properties and locations',
      isPrimary: true,
    },
  ],

  // Secondary items (CRM data)
  secondary: [
    {
      position: 5,
      label: 'Customers',
      icon: 'IconUsers',
      type: 'OBJECT',
      objectName: 'person',
      description: 'Customer contacts and information',
    },
    {
      position: 6,
      label: 'Contracts',
      icon: 'IconFileText',
      type: 'OBJECT',
      objectName: 'serviceAgreement',
      description: 'Service agreements and contracts',
    },
    {
      position: 7,
      label: 'Quotes',
      icon: 'IconDollarSign',
      type: 'OBJECT',
      objectName: 'quote',
      description: 'Quotes and estimates',
    },
    {
      position: 8,
      label: 'Invoices',
      icon: 'IconReceipt',
      type: 'OBJECT',
      objectName: 'invoice',
      description: 'Invoices and payments',
    },
  ],

  // Communication items
  communication: [
    {
      position: 9,
      label: 'Messages',
      icon: 'IconMail',
      type: 'OBJECT',
      objectName: 'message',
      description: 'Emails and messages',
    },
    {
      position: 10,
      label: 'SMS',
      icon: 'IconPhone',
      type: 'OBJECT',
      objectName: 'smsConversation',
      description: 'SMS conversations with clients',
    },
  ],

  // Team items
  team: [
    {
      position: 11,
      label: 'Team',
      icon: 'IconUsers',
      type: 'OBJECT',
      objectName: 'workspaceMember',
      description: 'Team members and roles',
    },
    {
      position: 12,
      label: 'Tasks',
      icon: 'IconCheckbox',
      type: 'OBJECT',
      objectName: 'task',
      description: 'Internal tasks and to-dos',
    },
  ],

  // Settings (bottom)
  settings: [
    {
      position: 13,
      label: 'Settings',
      icon: 'IconSettings',
      type: 'SETTINGS',
      description: 'Workspace settings and configuration',
    },
  ],
};

/**
 * Migration SQL to set up Jobber-style navigation
 * Run this during workspace initialization
 */
export const JOBBER_NAVIGATION_MIGRATION = `
-- Clear existing navigation items for fresh setup
DELETE FROM navigation_menu_item WHERE workspace_id = $workspaceId AND type != 'FOLDER';

-- Insert primary workflow items
INSERT INTO navigation_menu_item
  (id, workspace_id, label, position, type, target_object_metadata_id, is_custom)
SELECT
  gen_random_uuid(),
  $workspaceId,
  'Dashboard',
  1,
  'VIEW',
  om.id,
  false
FROM object_metadata om WHERE om.nameSingular = 'dashboard' AND om.workspace_id = $workspaceId;

INSERT INTO navigation_menu_item
  (id, workspace_id, label, position, type, target_object_metadata_id, is_custom)
SELECT
  gen_random_uuid(),
  $workspaceId,
  'Schedule',
  2,
  'OBJECT',
  om.id,
  false
FROM object_metadata om WHERE om.nameSingular = 'calendar' AND om.workspace_id = $workspaceId;

INSERT INTO navigation_menu_item
  (id, workspace_id, label, position, type, target_object_metadata_id, is_custom)
SELECT
  gen_random_uuid(),
  $workspaceId,
  'JobVisits',
  3,
  'OBJECT',
  om.id,
  false
FROM object_metadata om WHERE om.nameSingular = 'jobVisit' AND om.workspace_id = $workspaceId;

INSERT INTO navigation_menu_item
  (id, workspace_id, label, position, type, target_object_metadata_id, is_custom)
SELECT
  gen_random_uuid(),
  $workspaceId,
  'Properties',
  4,
  'OBJECT',
  om.id,
  false
FROM object_metadata om WHERE om.nameSingular = 'property' AND om.workspace_id = $workspaceId;

-- Insert secondary items
INSERT INTO navigation_menu_item
  (id, workspace_id, label, position, type, target_object_metadata_id, is_custom)
SELECT
  gen_random_uuid(),
  $workspaceId,
  'Customers',
  5,
  'OBJECT',
  om.id,
  false
FROM object_metadata om WHERE om.nameSingular = 'person' AND om.workspace_id = $workspaceId;

INSERT INTO navigation_menu_item
  (id, workspace_id, label, position, type, target_object_metadata_id, is_custom)
SELECT
  gen_random_uuid(),
  $workspaceId,
  'Invoices',
  8,
  'OBJECT',
  om.id,
  false
FROM object_metadata om WHERE om.nameSingular = 'invoice' AND om.workspace_id = $workspaceId;
`;

/**
 * Environment variables needed for SMS integration
 */
export const SMS_ENVIRONMENT_VARS = {
  TWILIO_ACCOUNT_SID: 'your-twilio-account-sid',
  TWILIO_AUTH_TOKEN: 'your-twilio-auth-token',
  TWILIO_PHONE_NUMBER: '+1234567890', // Your Twilio phone number
  SMS_WEBHOOK_URL: process.env.API_URL + '/webhooks/twilio/sms', // Webhook URL
};
