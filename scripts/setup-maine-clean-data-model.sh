#!/bin/bash
# Setup script for Maine Clean CRM data model
# Creates custom objects: Property, Job, Visit, Request
# Adds client type field to Company
#
# Usage:
#   TWENTY_API_URL=https://your-twenty.railway.app TWENTY_API_KEY=your-api-key bash scripts/setup-maine-clean-data-model.sh
#
# Get your API key from Twenty Settings > Accounts > API Keys

set -euo pipefail

API_URL="${TWENTY_API_URL:?Set TWENTY_API_URL (e.g. https://your-app.railway.app)}"
API_KEY="${TWENTY_API_KEY:?Set TWENTY_API_KEY (from Settings > Accounts > API Keys)}"

METADATA_URL="$API_URL/metadata"

gql() {
  local query="$1"
  local response
  response=$(curl -s -X POST "$METADATA_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "$query")

  if echo "$response" | grep -q '"errors"'; then
    echo "ERROR: $response" >&2
    return 1
  fi
  echo "$response"
}

extract_id() {
  echo "$1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

echo "=== Maine Clean CRM Data Model Setup ==="
echo ""

# ------------------------------------------------------------------
# Step 1: Create Property object
# ------------------------------------------------------------------
echo "Creating Property object..."
PROPERTY_RESULT=$(gql '{
  "query": "mutation { createOneObject(input: { object: { nameSingular: \"Property\", namePlural: \"Properties\", labelSingular: \"Property\", labelPlural: \"Properties\", description: \"Client properties (homes, offices, rentals)\", icon: \"IconBuildingSkyscraper\", isLabelSyncedWithName: true }}) { id nameSingular } }"
}')
PROPERTY_ID=$(extract_id "$PROPERTY_RESULT")
echo "  Property ID: $PROPERTY_ID"

# ------------------------------------------------------------------
# Step 2: Create Job object
# ------------------------------------------------------------------
echo "Creating Job object..."
JOB_RESULT=$(gql '{
  "query": "mutation { createOneObject(input: { object: { nameSingular: \"Job\", namePlural: \"Jobs\", labelSingular: \"Job\", labelPlural: \"Jobs\", description: \"Cleaning jobs for a property (deep clean, recurring, etc.)\", icon: \"IconBriefcase\", isLabelSyncedWithName: true }}) { id nameSingular } }"
}')
JOB_ID=$(extract_id "$JOB_RESULT")
echo "  Job ID: $JOB_ID"

# ------------------------------------------------------------------
# Step 3: Create Visit object
# ------------------------------------------------------------------
echo "Creating Visit object..."
VISIT_RESULT=$(gql '{
  "query": "mutation { createOneObject(input: { object: { nameSingular: \"Visit\", namePlural: \"Visits\", labelSingular: \"Visit\", labelPlural: \"Visits\", description: \"Scheduled cleaning visits synced to Google Calendar\", icon: \"IconCalendarEvent\", isLabelSyncedWithName: true }}) { id nameSingular } }"
}')
VISIT_ID=$(extract_id "$VISIT_RESULT")
echo "  Visit ID: $VISIT_ID"

# ------------------------------------------------------------------
# Step 4: Create Request object (website intake)
# ------------------------------------------------------------------
echo "Creating Request object..."
REQUEST_RESULT=$(gql '{
  "query": "mutation { createOneObject(input: { object: { nameSingular: \"Request\", namePlural: \"Requests\", labelSingular: \"Request\", labelPlural: \"Requests\", description: \"Incoming requests from maineclean.co website\", icon: \"IconInbox\", isLabelSyncedWithName: true }}) { id nameSingular } }"
}')
REQUEST_ID=$(extract_id "$REQUEST_RESULT")
echo "  Request ID: $REQUEST_ID"

# ------------------------------------------------------------------
# Step 5: Find Company object ID
# ------------------------------------------------------------------
echo "Finding Company object..."
COMPANY_RESULT=$(gql '{
  "query": "{ objects(paging: { first: 50 }) { edges { node { id nameSingular } } } }"
}')
COMPANY_ID=$(echo "$COMPANY_RESULT" | grep -o '"id":"[^"]*","nameSingular":"company"' | head -1 | cut -d'"' -f4)
if [ -z "$COMPANY_ID" ]; then
  COMPANY_ID=$(echo "$COMPANY_RESULT" | grep -o '"nameSingular":"company","id":"[^"]*"' | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
fi
echo "  Company ID: $COMPANY_ID"

# ------------------------------------------------------------------
# Step 6: Add Client Type field to Company
# ------------------------------------------------------------------
echo "Adding clientType field to Company..."
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$COMPANY_ID\\\", type: SELECT, name: \\\"clientType\\\", label: \\\"Client Type\\\", description: \\\"Type of client\\\", icon: \\\"IconUsers\\\", options: [{label: \\\"Residential\\\", value: \\\"RESIDENTIAL\\\", color: \\\"blue\\\", position: 0}, {label: \\\"Commercial\\\", value: \\\"COMMERCIAL\\\", color: \\\"green\\\", position: 1}, {label: \\\"Short-Term Rental\\\", value: \\\"SHORT_TERM_RENTAL\\\", color: \\\"orange\\\", position: 2}] }}) { id name } }\"
}" > /dev/null
echo "  Done"

# ------------------------------------------------------------------
# Step 7: Add Property fields
# ------------------------------------------------------------------
echo "Adding Property fields..."

# Address
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: ADDRESS, name: \\\"address\\\", label: \\\"Address\\\", icon: \\\"IconMapPin\\\" }}) { id } }\"
}" > /dev/null
echo "  address (ADDRESS)"

# Property type
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: SELECT, name: \\\"propertyType\\\", label: \\\"Property Type\\\", icon: \\\"IconHome\\\", options: [{label: \\\"House\\\", value: \\\"HOUSE\\\", color: \\\"blue\\\", position: 0}, {label: \\\"Apartment\\\", value: \\\"APARTMENT\\\", color: \\\"sky\\\", position: 1}, {label: \\\"Condo\\\", value: \\\"CONDO\\\", color: \\\"turquoise\\\", position: 2}, {label: \\\"Office\\\", value: \\\"OFFICE\\\", color: \\\"green\\\", position: 3}, {label: \\\"Retail\\\", value: \\\"RETAIL\\\", color: \\\"purple\\\", position: 4}, {label: \\\"Vacation Rental\\\", value: \\\"VACATION_RENTAL\\\", color: \\\"orange\\\", position: 5}, {label: \\\"Other\\\", value: \\\"OTHER\\\", color: \\\"gray\\\", position: 6}] }}) { id } }\"
}" > /dev/null
echo "  propertyType (SELECT)"

# Square footage
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: NUMBER, name: \\\"sqft\\\", label: \\\"Square Feet\\\", icon: \\\"IconRulerMeasure\\\", settings: {dataType: \\\"int\\\"} }}) { id } }\"
}" > /dev/null
echo "  sqft (NUMBER)"

# Bedrooms
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: NUMBER, name: \\\"bedrooms\\\", label: \\\"Bedrooms\\\", icon: \\\"IconBed\\\", settings: {dataType: \\\"int\\\"} }}) { id } }\"
}" > /dev/null
echo "  bedrooms (NUMBER)"

# Bathrooms
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: NUMBER, name: \\\"bathrooms\\\", label: \\\"Bathrooms\\\", icon: \\\"IconBath\\\", settings: {dataType: \\\"int\\\"} }}) { id } }\"
}" > /dev/null
echo "  bathrooms (NUMBER)"

# Access instructions
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: TEXT, name: \\\"accessInstructions\\\", label: \\\"Access Instructions\\\", icon: \\\"IconKey\\\", description: \\\"Lockbox code, where to park, etc.\\\" }}) { id } }\"
}" > /dev/null
echo "  accessInstructions (TEXT)"

# Pet info
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: BOOLEAN, name: \\\"hasPets\\\", label: \\\"Has Pets\\\", icon: \\\"IconPaw\\\" }}) { id } }\"
}" > /dev/null
echo "  hasPets (BOOLEAN)"

# Notes
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: RICH_TEXT, name: \\\"notes\\\", label: \\\"Notes\\\", icon: \\\"IconNotes\\\" }}) { id } }\"
}" > /dev/null
echo "  notes (RICH_TEXT)"

# Relation: Property -> Company
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$PROPERTY_ID\\\", type: RELATION, name: \\\"company\\\", label: \\\"Company\\\", icon: \\\"IconBuildingStore\\\", description: \\\"Client who owns this property\\\", settings: {relationType: \\\"MANY_TO_ONE\\\"}, relationCreationPayload: {type: \\\"MANY_TO_ONE\\\", targetObjectMetadataId: \\\"$COMPANY_ID\\\", targetFieldLabel: \\\"Properties\\\", targetFieldIcon: \\\"IconBuildingSkyscraper\\\"} }}) { id } }\"
}" > /dev/null
echo "  company -> Company (MANY_TO_ONE)"

# ------------------------------------------------------------------
# Step 8: Add Job fields
# ------------------------------------------------------------------
echo "Adding Job fields..."

# Job type
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$JOB_ID\\\", type: SELECT, name: \\\"jobType\\\", label: \\\"Job Type\\\", icon: \\\"IconSparkles\\\", options: [{label: \\\"Standard Clean\\\", value: \\\"STANDARD\\\", color: \\\"blue\\\", position: 0}, {label: \\\"Deep Clean\\\", value: \\\"DEEP\\\", color: \\\"purple\\\", position: 1}, {label: \\\"Move In/Out\\\", value: \\\"MOVE_IN_OUT\\\", color: \\\"green\\\", position: 2}, {label: \\\"Post-Construction\\\", value: \\\"POST_CONSTRUCTION\\\", color: \\\"orange\\\", position: 3}, {label: \\\"STR Turnover\\\", value: \\\"STR_TURNOVER\\\", color: \\\"turquoise\\\", position: 4}, {label: \\\"One-Time\\\", value: \\\"ONE_TIME\\\", color: \\\"sky\\\", position: 5}] }}) { id } }\"
}" > /dev/null
echo "  jobType (SELECT)"

# Frequency
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$JOB_ID\\\", type: SELECT, name: \\\"frequency\\\", label: \\\"Frequency\\\", icon: \\\"IconRepeat\\\", options: [{label: \\\"Weekly\\\", value: \\\"WEEKLY\\\", color: \\\"blue\\\", position: 0}, {label: \\\"Biweekly\\\", value: \\\"BIWEEKLY\\\", color: \\\"sky\\\", position: 1}, {label: \\\"Monthly\\\", value: \\\"MONTHLY\\\", color: \\\"green\\\", position: 2}, {label: \\\"One-Time\\\", value: \\\"ONE_TIME\\\", color: \\\"gray\\\", position: 3}, {label: \\\"As Needed\\\", value: \\\"AS_NEEDED\\\", color: \\\"orange\\\", position: 4}] }}) { id } }\"
}" > /dev/null
echo "  frequency (SELECT)"

# Status
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$JOB_ID\\\", type: SELECT, name: \\\"status\\\", label: \\\"Status\\\", icon: \\\"IconStatusChange\\\", options: [{label: \\\"Active\\\", value: \\\"ACTIVE\\\", color: \\\"green\\\", position: 0}, {label: \\\"Paused\\\", value: \\\"PAUSED\\\", color: \\\"orange\\\", position: 1}, {label: \\\"Completed\\\", value: \\\"COMPLETED\\\", color: \\\"blue\\\", position: 2}, {label: \\\"Cancelled\\\", value: \\\"CANCELLED\\\", color: \\\"red\\\", position: 3}] }}) { id } }\"
}" > /dev/null
echo "  status (SELECT)"

# Price
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$JOB_ID\\\", type: CURRENCY, name: \\\"price\\\", label: \\\"Price\\\", icon: \\\"IconCurrencyDollar\\\", description: \\\"Price per visit\\\" }}) { id } }\"
}" > /dev/null
echo "  price (CURRENCY)"

# Estimated hours
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$JOB_ID\\\", type: NUMBER, name: \\\"estimatedHours\\\", label: \\\"Estimated Hours\\\", icon: \\\"IconClock\\\", settings: {dataType: \\\"float\\\", decimals: 1} }}) { id } }\"
}" > /dev/null
echo "  estimatedHours (NUMBER)"

# Notes
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$JOB_ID\\\", type: RICH_TEXT, name: \\\"notes\\\", label: \\\"Notes\\\", icon: \\\"IconNotes\\\", description: \\\"Special instructions for this job\\\" }}) { id } }\"
}" > /dev/null
echo "  notes (RICH_TEXT)"

# Relation: Job -> Property
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$JOB_ID\\\", type: RELATION, name: \\\"property\\\", label: \\\"Property\\\", icon: \\\"IconBuildingSkyscraper\\\", settings: {relationType: \\\"MANY_TO_ONE\\\"}, relationCreationPayload: {type: \\\"MANY_TO_ONE\\\", targetObjectMetadataId: \\\"$PROPERTY_ID\\\", targetFieldLabel: \\\"Jobs\\\", targetFieldIcon: \\\"IconBriefcase\\\"} }}) { id } }\"
}" > /dev/null
echo "  property -> Property (MANY_TO_ONE)"

# ------------------------------------------------------------------
# Step 9: Add Visit fields
# ------------------------------------------------------------------
echo "Adding Visit fields..."

# Scheduled date
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$VISIT_ID\\\", type: DATE_TIME, name: \\\"scheduledAt\\\", label: \\\"Scheduled At\\\", icon: \\\"IconCalendar\\\", description: \\\"When the visit is scheduled\\\" }}) { id } }\"
}" > /dev/null
echo "  scheduledAt (DATE_TIME)"

# Duration in minutes
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$VISIT_ID\\\", type: NUMBER, name: \\\"durationMinutes\\\", label: \\\"Duration (min)\\\", icon: \\\"IconClock\\\", settings: {dataType: \\\"int\\\"} }}) { id } }\"
}" > /dev/null
echo "  durationMinutes (NUMBER)"

# Status
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$VISIT_ID\\\", type: SELECT, name: \\\"status\\\", label: \\\"Status\\\", icon: \\\"IconStatusChange\\\", options: [{label: \\\"Scheduled\\\", value: \\\"SCHEDULED\\\", color: \\\"blue\\\", position: 0}, {label: \\\"In Progress\\\", value: \\\"IN_PROGRESS\\\", color: \\\"orange\\\", position: 1}, {label: \\\"Completed\\\", value: \\\"COMPLETED\\\", color: \\\"green\\\", position: 2}, {label: \\\"Cancelled\\\", value: \\\"CANCELLED\\\", color: \\\"red\\\", position: 3}, {label: \\\"No Show\\\", value: \\\"NO_SHOW\\\", color: \\\"gray\\\", position: 4}] }}) { id } }\"
}" > /dev/null
echo "  status (SELECT)"

# Crew/assignee
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$VISIT_ID\\\", type: TEXT, name: \\\"crew\\\", label: \\\"Crew\\\", icon: \\\"IconUsersGroup\\\", description: \\\"Assigned cleaning crew\\\" }}) { id } }\"
}" > /dev/null
echo "  crew (TEXT)"

# Notes
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$VISIT_ID\\\", type: RICH_TEXT, name: \\\"notes\\\", label: \\\"Notes\\\", icon: \\\"IconNotes\\\" }}) { id } }\"
}" > /dev/null
echo "  notes (RICH_TEXT)"

# Google Calendar event ID (for sync)
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$VISIT_ID\\\", type: TEXT, name: \\\"calendarEventId\\\", label: \\\"Calendar Event ID\\\", icon: \\\"IconLink\\\", description: \\\"Google Calendar event ID for sync\\\" }}) { id } }\"
}" > /dev/null
echo "  calendarEventId (TEXT)"

# Relation: Visit -> Job
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$VISIT_ID\\\", type: RELATION, name: \\\"job\\\", label: \\\"Job\\\", icon: \\\"IconBriefcase\\\", settings: {relationType: \\\"MANY_TO_ONE\\\"}, relationCreationPayload: {type: \\\"MANY_TO_ONE\\\", targetObjectMetadataId: \\\"$JOB_ID\\\", targetFieldLabel: \\\"Visits\\\", targetFieldIcon: \\\"IconCalendarEvent\\\"} }}) { id } }\"
}" > /dev/null
echo "  job -> Job (MANY_TO_ONE)"

# ------------------------------------------------------------------
# Step 10: Add Request fields (website intake)
# ------------------------------------------------------------------
echo "Adding Request fields..."

# Source
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: SELECT, name: \\\"source\\\", label: \\\"Source\\\", icon: \\\"IconWorld\\\", options: [{label: \\\"Website Form\\\", value: \\\"WEBSITE_FORM\\\", color: \\\"blue\\\", position: 0}, {label: \\\"Contact Form\\\", value: \\\"CONTACT_FORM\\\", color: \\\"green\\\", position: 1}, {label: \\\"Booking\\\", value: \\\"BOOKING\\\", color: \\\"purple\\\", position: 2}, {label: \\\"Phone\\\", value: \\\"PHONE\\\", color: \\\"sky\\\", position: 3}, {label: \\\"Referral\\\", value: \\\"REFERRAL\\\", color: \\\"orange\\\", position: 4}] }}) { id } }\"
}" > /dev/null
echo "  source (SELECT)"

# Service type
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: SELECT, name: \\\"serviceType\\\", label: \\\"Service Type\\\", icon: \\\"IconSparkles\\\", options: [{label: \\\"Standard\\\", value: \\\"STANDARD\\\", color: \\\"blue\\\", position: 0}, {label: \\\"Deep Clean\\\", value: \\\"DEEP\\\", color: \\\"purple\\\", position: 1}, {label: \\\"Vacation Rental\\\", value: \\\"VACATION_RENTAL\\\", color: \\\"orange\\\", position: 2}, {label: \\\"Commercial\\\", value: \\\"COMMERCIAL\\\", color: \\\"green\\\", position: 3}] }}) { id } }\"
}" > /dev/null
echo "  serviceType (SELECT)"

# Frequency
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: SELECT, name: \\\"frequency\\\", label: \\\"Frequency\\\", icon: \\\"IconRepeat\\\", options: [{label: \\\"Weekly\\\", value: \\\"WEEKLY\\\", color: \\\"blue\\\", position: 0}, {label: \\\"Biweekly\\\", value: \\\"BIWEEKLY\\\", color: \\\"sky\\\", position: 1}, {label: \\\"Monthly\\\", value: \\\"MONTHLY\\\", color: \\\"green\\\", position: 2}, {label: \\\"One-Time\\\", value: \\\"ONE_TIME\\\", color: \\\"gray\\\", position: 3}] }}) { id } }\"
}" > /dev/null
echo "  frequency (SELECT)"

# Status
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: SELECT, name: \\\"status\\\", label: \\\"Status\\\", icon: \\\"IconStatusChange\\\", options: [{label: \\\"New\\\", value: \\\"NEW\\\", color: \\\"blue\\\", position: 0}, {label: \\\"Contacted\\\", value: \\\"CONTACTED\\\", color: \\\"sky\\\", position: 1}, {label: \\\"Quoted\\\", value: \\\"QUOTED\\\", color: \\\"orange\\\", position: 2}, {label: \\\"Converted\\\", value: \\\"CONVERTED\\\", color: \\\"green\\\", position: 3}, {label: \\\"Lost\\\", value: \\\"LOST\\\", color: \\\"red\\\", position: 4}] }}) { id } }\"
}" > /dev/null
echo "  status (SELECT)"

# Contact email
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: EMAILS, name: \\\"email\\\", label: \\\"Email\\\", icon: \\\"IconMail\\\" }}) { id } }\"
}" > /dev/null
echo "  email (EMAILS)"

# Contact phone
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: PHONES, name: \\\"phone\\\", label: \\\"Phone\\\", icon: \\\"IconPhone\\\" }}) { id } }\"
}" > /dev/null
echo "  phone (PHONES)"

# Address
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: ADDRESS, name: \\\"address\\\", label: \\\"Address\\\", icon: \\\"IconMapPin\\\" }}) { id } }\"
}" > /dev/null
echo "  address (ADDRESS)"

# Sqft
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: NUMBER, name: \\\"sqft\\\", label: \\\"Square Feet\\\", icon: \\\"IconRulerMeasure\\\", settings: {dataType: \\\"int\\\"} }}) { id } }\"
}" > /dev/null
echo "  sqft (NUMBER)"

# Bathrooms
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: NUMBER, name: \\\"bathrooms\\\", label: \\\"Bathrooms\\\", icon: \\\"IconBath\\\", settings: {dataType: \\\"int\\\"} }}) { id } }\"
}" > /dev/null
echo "  bathrooms (NUMBER)"

# Estimate range
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: CURRENCY, name: \\\"estimateMin\\\", label: \\\"Estimate Min\\\", icon: \\\"IconCurrencyDollar\\\" }}) { id } }\"
}" > /dev/null
echo "  estimateMin (CURRENCY)"

gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: CURRENCY, name: \\\"estimateMax\\\", label: \\\"Estimate Max\\\", icon: \\\"IconCurrencyDollar\\\" }}) { id } }\"
}" > /dev/null
echo "  estimateMax (CURRENCY)"

# Message/notes
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: RICH_TEXT, name: \\\"notes\\\", label: \\\"Notes\\\", icon: \\\"IconNotes\\\" }}) { id } }\"
}" > /dev/null
echo "  notes (RICH_TEXT)"

# Requested date
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: DATE_TIME, name: \\\"requestedDate\\\", label: \\\"Requested Date\\\", icon: \\\"IconCalendar\\\" }}) { id } }\"
}" > /dev/null
echo "  requestedDate (DATE_TIME)"

# Relation: Request -> Company (optional, linked when converted)
gql "{
  \"query\": \"mutation { createOneField(input: { field: { objectMetadataId: \\\"$REQUEST_ID\\\", type: RELATION, name: \\\"company\\\", label: \\\"Company\\\", icon: \\\"IconBuildingStore\\\", description: \\\"Linked client (when converted)\\\", settings: {relationType: \\\"MANY_TO_ONE\\\"}, relationCreationPayload: {type: \\\"MANY_TO_ONE\\\", targetObjectMetadataId: \\\"$COMPANY_ID\\\", targetFieldLabel: \\\"Requests\\\", targetFieldIcon: \\\"IconInbox\\\"} }}) { id } }\"
}" > /dev/null
echo "  company -> Company (MANY_TO_ONE)"

echo ""
echo "=== Data model setup complete! ==="
echo ""
echo "Relationship chain:"
echo "  Company (+ clientType: Residential/Commercial/STR)"
echo "    -> Properties (address, type, sqft, bedrooms, bathrooms, pets, access)"
echo "       -> Jobs (type, frequency, status, price, hours)"
echo "          -> Visits (scheduledAt, duration, status, crew, calendarEventId)"
echo ""
echo "  Request (website intake -> convert to Company + Property + Job)"
echo ""
echo "Object IDs for API integration:"
echo "  PROPERTY_ID=$PROPERTY_ID"
echo "  JOB_ID=$JOB_ID"
echo "  VISIT_ID=$VISIT_ID"
echo "  REQUEST_ID=$REQUEST_ID"
echo "  COMPANY_ID=$COMPANY_ID"
