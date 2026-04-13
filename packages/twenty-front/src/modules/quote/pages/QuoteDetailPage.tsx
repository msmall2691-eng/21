import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from '@emotion/styled';
import { useQuote } from '../hooks/useQuote';

const Container = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: bold;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 2rem;
  gap: 1rem;
`;

const Tab = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  padding: 1rem;
  cursor: pointer;
  font-weight: ${(props) => (props.active ? 'bold' : 'normal')};
  border-bottom: 3px solid ${(props) => (props.active ? '#000' : 'transparent')};
  transition: all 0.2s ease;

  &:hover {
    border-bottom-color: #ddd;
  }
`;

const ContentSection = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: bold;
  margin-bottom: 1rem;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;

  label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #666;
    margin-bottom: 0.25rem;
  }

  value {
    font-size: 1rem;
    color: #000;
  }
`;

const LineItemsTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    background-color: #f5f5f5;
    padding: 0.75rem;
    text-align: left;
    border-bottom: 2px solid #e0e0e0;
    font-weight: 600;
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid #e0e0e0;
  }
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 0.25rem;
  border: 1px solid #ddd;
  background-color: #fff;
  cursor: pointer;
  font-weight: 500;

  &:hover {
    background-color: #f5f5f5;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled(Button)`
  background-color: #000;
  color: #fff;
  border-color: #000;

  &:hover {
    background-color: #333;
  }
`;

export const QuoteDetailPage: React.FC = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [activeTab, setActiveTab] = useState('overview');
  const { quote, loading, error } = useQuote(quoteId || '');

  if (loading) return <Container>Loading quote...</Container>;
  if (error) return <Container>Error loading quote: {error.message}</Container>;
  if (!quote) return <Container>Quote not found</Container>;

  const tabs = ['overview', 'lineItems', 'attachments', 'activity'];

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '$0.00';
    return `$${amount.toFixed(2)}`;
  };

  return (
    <Container>
      <Header>
        <div>
          <Title>{quote.quoteNumber}</Title>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>
            {quote.person?.name || 'Unknown Customer'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button>Download PDF</Button>
          <PrimaryButton disabled title="Available in the next release">
            Send for Approval
          </PrimaryButton>
        </div>
      </Header>

      <TabContainer>
        {tabs.map((tab) => (
          <Tab
            key={tab}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Tab>
        ))}
      </TabContainer>

      {activeTab === 'overview' && (
        <>
          <ContentSection>
            <SectionTitle>Quote Details</SectionTitle>
            <InfoGrid>
              <InfoItem>
                <label>Status</label>
                <value>{quote.status}</value>
              </InfoItem>
              <InfoItem>
                <label>Service Type</label>
                <value>{quote.serviceType}</value>
              </InfoItem>
              <InfoItem>
                <label>Frequency</label>
                <value>{quote.frequency}</value>
              </InfoItem>
              <InfoItem>
                <label>Created</label>
                <value>{new Date(quote.createdAt).toLocaleDateString()}</value>
              </InfoItem>
              <InfoItem>
                <label>Expires</label>
                <value>
                  {quote.expiresAt
                    ? new Date(quote.expiresAt).toLocaleDateString()
                    : 'N/A'}
                </value>
              </InfoItem>
            </InfoGrid>
          </ContentSection>

          <ContentSection>
            <SectionTitle>Pricing Summary</SectionTitle>
            <InfoGrid>
              <InfoItem>
                <label>Subtotal</label>
                <value>{formatCurrency(quote.subtotal)}</value>
              </InfoItem>
              <InfoItem>
                <label>Discount</label>
                <value>{formatCurrency(quote.discountTotal)}</value>
              </InfoItem>
              <InfoItem>
                <label>Tax</label>
                <value>{formatCurrency(quote.taxTotal)}</value>
              </InfoItem>
              <InfoItem>
                <label>Total</label>
                <value style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                  {formatCurrency(quote.total)}
                </value>
              </InfoItem>
            </InfoGrid>
          </ContentSection>

          <ContentSection>
            <SectionTitle>Notes</SectionTitle>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Customer Notes
              </label>
              <textarea
                value={quote.customerNotes || ''}
                readOnly
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '0.25rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Internal Notes
              </label>
              <textarea
                value={quote.internalNotes || ''}
                readOnly
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '0.25rem',
                }}
              />
            </div>
          </ContentSection>
        </>
      )}

      {activeTab === 'lineItems' && (
        <ContentSection>
          <SectionTitle>Line Items</SectionTitle>
          <LineItemsTable>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems && quote.lineItems.length > 0 ? (
                quote.lineItems.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.total)}</td>
                    <td>{item.kind}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </LineItemsTable>
        </ContentSection>
      )}

      {activeTab === 'attachments' && (
        <ContentSection>
          <SectionTitle>Attachments</SectionTitle>
          <p style={{ color: '#666' }}>
            {quote.attachments?.edges?.length || 0} file(s) attached
          </p>
          {quote.attachments?.edges && quote.attachments.edges.length > 0 && (
            <ul style={{ marginTop: '1rem' }}>
              {quote.attachments.edges.map((edge: any) => (
                <li key={edge.node.id} style={{ marginBottom: '0.5rem' }}>
                  <a href="#" style={{ color: '#0066cc' }}>
                    {edge.node.fileName}
                  </a>
                  <span style={{ color: '#666', fontSize: '0.875rem' }}>
                    {' '}
                    ({new Date(edge.node.createdAt).toLocaleDateString()})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ContentSection>
      )}

      {activeTab === 'activity' && (
        <ContentSection>
          <SectionTitle>Activity Feed</SectionTitle>
          <p style={{ color: '#666' }}>Activity tracking coming soon</p>
        </ContentSection>
      )}
    </Container>
  );
};

export default QuoteDetailPage;
