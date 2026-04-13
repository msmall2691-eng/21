import React, { useMemo, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { useNavigate } from 'react-router-dom';

const GET_QUOTES_QUERY = gql`
  query GetQuotes($filter: QuoteFilter) {
    quotes(filter: $filter) {
      edges {
        node {
          id
          quoteNumber
          status
          person {
            id
            name
          }
          serviceType
          total
          createdAt
        }
      }
    }
  }
`;

const Container = styled.div`
  padding: 2rem;
  width: 100%;
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;

  thead {
    background-color: #f5f5f5;
  }

  th {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 2px solid #e0e0e0;
    font-weight: 600;
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid #e0e0e0;
  }

  tbody tr:hover {
    background-color: #f9f9f9;
    cursor: pointer;
  }
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  background-color: ${(props) => {
    switch (props.status) {
      case 'DRAFT':
        return '#FFF3CD';
      case 'SENT':
        return '#D1ECF1';
      case 'APPROVED':
        return '#D4EDDA';
      case 'DECLINED':
        return '#F8D7DA';
      case 'EXPIRED':
        return '#E8E8E8';
      default:
        return '#E8E8E8';
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case 'DRAFT':
        return '#856404';
      case 'SENT':
        return '#0C5460';
      case 'APPROVED':
        return '#155724';
      case 'DECLINED':
        return '#721C24';
      case 'EXPIRED':
        return '#383D41';
      default:
        return '#383D41';
    }
  }};
`;

export interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  person: { id: string; name: string };
  serviceType: string;
  total: number;
  createdAt: string;
}

export const QuoteListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data, loading, error } = useQuery(GET_QUOTES_QUERY, {
    variables: {
      filter: statusFilter ? { status: statusFilter } : {},
    },
  });

  const quotes = useMemo(() => {
    if (!data?.quotes?.edges) return [];
    return data.quotes.edges.map((edge: any) => edge.node);
  }, [data]);

  const handleRowClick = (quoteId: string) => {
    navigate(`/quotes/${quoteId}`);
  };

  if (loading) return <Container>Loading quotes...</Container>;
  if (error) return <Container>Error loading quotes: {error.message}</Container>;

  return (
    <Container>
      <Header>
        <Title>Quotes</Title>
        <select
          value={statusFilter || ''}
          onChange={(e) => setStatusFilter(e.target.value || null)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            border: '1px solid #ddd',
          }}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="APPROVED">Approved</option>
          <option value="DECLINED">Declined</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </Header>

      <Table>
        <thead>
          <tr>
            <th>Quote #</th>
            <th>Customer</th>
            <th>Service Type</th>
            <th>Total</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {quotes.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center' }}>
                No quotes found
              </td>
            </tr>
          ) : (
            quotes.map((quote: Quote) => (
              <tr
                key={quote.id}
                onClick={() => handleRowClick(quote.id)}
              >
                <td>{quote.quoteNumber}</td>
                <td>{quote.person?.name || 'Unknown'}</td>
                <td>{quote.serviceType}</td>
                <td>${quote.total?.toFixed(2) || '0.00'}</td>
                <td>
                  <StatusBadge status={quote.status}>
                    {quote.status}
                  </StatusBadge>
                </td>
                <td>
                  {new Date(quote.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Container>
  );
};

export default QuoteListPage;
