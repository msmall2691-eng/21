import { useQuery } from '@apollo/client/react';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useState, useEffect } from 'react';
import { styled } from '@linaria/react';
import {
  IconPlus,
  IconSend,
  IconClock,
  IconSearch,
  IconFilter,
} from 'twenty-ui';

const MessagingContainer = styled.div`
  display: flex;
  height: 100%;
  gap: 0;
  background-color: #fafbfc;
`;

const SidebarContainer = styled.div`
  width: 320px;
  border-right: 1px solid #e0e6ed;
  display: flex;
  flex-direction: column;
  background: white;
  overflow-y: auto;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f1419;
`;

const ComposeButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #0f1419;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;

  &:hover {
    background-color: #1a1f2e;
  }
`;

const SearchContainer = styled.div`
  padding: 12px 16px;
  display: flex;
  gap: 8px;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d0d7e6;
  border-radius: 6px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #0f1419;
    box-shadow: 0 0 0 2px rgba(15, 20, 25, 0.1);
  }
`;

const FilterButton = styled.button`
  padding: 8px 12px;
  background: white;
  border: 1px solid #d0d7e6;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #525866;

  &:hover {
    background-color: #f3f4f6;
  }
`;

const FoldersList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
`;

const FolderItem = styled.div<{ active?: boolean }>`
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  color: ${(props) => (props.active ? '#0f1419' : '#525866')};
  background-color: ${(props) => (props.active ? '#f0f0f8' : 'transparent')};
  border-left: 3px solid ${(props) => (props.active ? '#0f1419' : 'transparent')};
  font-weight: ${(props) => (props.active ? '500' : '400')};

  &:hover {
    background-color: ${(props) => (props.active ? '#f0f0f8' : '#f9fafb')};
  }
`;

const FolderIcon = styled.span`
  font-size: 18px;
`;

const FolderLabel = styled.span`
  font-size: 14px;
  flex: 1;
`;

const CountBadge = styled.span`
  padding: 2px 8px;
  background-color: #0f1419;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
`;

const HeaderBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e6ed;
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #0f1419;
`;

const SyncIndicator = styled.div<{ synced: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background-color: ${(props) => (props.synced ? '#d4edda' : '#fff3cd')};
  border: 1px solid ${(props) => (props.synced ? '#c3e6cb' : '#ffeaa7')};
  border-radius: 6px;
  font-size: 12px;
  color: ${(props) => (props.synced ? '#155724' : '#856404')};
  font-weight: 500;
`;

const SyncDot = styled.span<{ synced: boolean }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${(props) => (props.synced ? '#28a745' : '#ffc107')};
  animation: ${(props) => (props.synced ? 'none' : 'pulse 2s infinite')};

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

const MessagesList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  margin-bottom: 20px;
`;

const MessageCard = styled.div<{ unread?: boolean }>`
  padding: 16px;
  background: ${(props) => (props.unread ? '#ffffff' : '#f9fafb')};
  border: 1px solid #e0e6ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: ${(props) => (props.unread ? '600' : '400')};

  &:hover {
    border-color: #0f1419;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const MessageFrom = styled.div`
  font-size: 14px;
  color: #0f1419;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const MessageSubject = styled.div`
  font-size: 13px;
  color: #525866;
  margin-bottom: 8px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const MessagePreview = styled.div`
  font-size: 12px;
  color: #7a818e;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #7a818e;
`;

const EmptyStateIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyStateText = styled.div`
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const EmptyStateSubtext = styled.div`
  font-size: 14px;
  color: #a4adb8;
`;

const ComposeModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ComposeForm = styled.div`
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const FormHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const FormBody = styled.div`
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FormLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: #0f1419;
`;

const FormInput = styled.input`
  padding: 10px 12px;
  border: 1px solid #d0d7e6;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #0f1419;
    box-shadow: 0 0 0 2px rgba(15, 20, 25, 0.1);
  }
`;

const FormTextArea = styled.textarea`
  padding: 10px 12px;
  border: 1px solid #d0d7e6;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 150px;

  &:focus {
    outline: none;
    border-color: #0f1419;
    box-shadow: 0 0 0 2px rgba(15, 20, 25, 0.1);
  }
`;

const FormFooter = styled.div`
  padding: 12px 16px;
  border-top: 1px solid #e0e6ed;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;

  ${(props) =>
    props.variant === 'primary'
      ? `
    background-color: #0f1419;
    color: white;

    &:hover {
      background-color: #1a1f2e;
    }
  `
      : `
    background-color: #f3f4f6;
    color: #525866;

    &:hover {
      background-color: #e5e7eb;
    }
  `}
`;

const ScheduleSection = styled.div`
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 6px;
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ScheduleToggle = styled.input`
  cursor: pointer;
`;

const ScheduleLabel = styled.label`
  font-size: 13px;
  color: #525866;
  cursor: pointer;
`;

const ScheduleTime = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d0d7e6;
  border-radius: 4px;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: #0f1419;
  }
`;

export const MessagingPage = () => {
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSynced, setIsSynced] = useState(true);
  const [scheduleEmail, setScheduleEmail] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    body: '',
    channel: 'email' as 'email' | 'sms',
  });

  const folders = [
    { id: 'inbox', label: 'Inbox', icon: '📥', count: 5 },
    { id: 'sent', label: 'Sent', icon: '📤', count: 0 },
    { id: 'drafts', label: 'Drafts', icon: '📝', count: 2 },
    { id: 'scheduled', label: 'Scheduled', icon: '⏰', count: 1 },
    { id: 'archive', label: 'Archive', icon: '📦', count: 0 },
  ];

  const mockMessages = [
    {
      id: '1',
      from: 'client@example.com',
      fromName: 'John Client',
      subject: 'Cleaning service inquiry',
      preview: 'Hi, I would like to schedule a cleaning service...',
      timestamp: new Date(Date.now() - 3600000),
      unread: true,
      channel: 'email',
    },
    {
      id: '2',
      from: '+1234567890',
      fromName: 'Unknown Caller',
      subject: 'SMS: Service inquiry',
      preview: 'Hi, interested in your cleaning services',
      timestamp: new Date(Date.now() - 7200000),
      unread: true,
      channel: 'sms',
    },
    {
      id: '3',
      from: 'manager@maineclean.co',
      fromName: 'You',
      subject: 'Re: Project quote',
      preview: 'Thanks for getting back to us, here is the quote...',
      timestamp: new Date(Date.now() - 86400000),
      unread: false,
      channel: 'email',
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIsSynced(Math.random() > 0.3);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleCompose = () => {
    setShowCompose(true);
  };

  const handleCloseCompose = () => {
    setShowCompose(false);
    setComposeData({ to: '', subject: '', body: '', channel: 'email' });
    setScheduleEmail(false);
    setScheduleTime('');
  };

  const handleSendEmail = () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      alert('Please fill in all fields');
      return;
    }

    if (scheduleEmail && !scheduleTime) {
      alert('Please select a schedule time');
      return;
    }

    console.log('Sending message:', {
      ...composeData,
      scheduled: scheduleEmail,
      scheduledTime: scheduleTime,
    });

    handleCloseCompose();
  };

  const filteredMessages = mockMessages.filter((msg) =>
    msg.fromName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageContainer>
      <MessagingContainer>
        <SidebarContainer>
          <SidebarHeader>
            <SidebarTitle>Messages</SidebarTitle>
          </SidebarHeader>

          <SearchContainer>
            <SearchInput
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FilterButton title="Filter messages">
              <IconFilter size={18} />
            </FilterButton>
          </SearchContainer>

          <div style={{ padding: '12px 16px' }}>
            <ComposeButton onClick={handleCompose}>
              <IconPlus size={18} />
              Compose
            </ComposeButton>
          </div>

          <FoldersList>
            {folders.map((folder) => (
              <FolderItem
                key={folder.id}
                active={activeFolder === folder.id}
                onClick={() => setActiveFolder(folder.id)}
              >
                <FolderIcon>{folder.icon}</FolderIcon>
                <FolderLabel>{folder.label}</FolderLabel>
                {folder.count > 0 && <CountBadge>{folder.count}</CountBadge>}
              </FolderItem>
            ))}
          </FoldersList>
        </SidebarContainer>

        <MainContent>
          <ContentArea>
            <HeaderBar>
              <div>
                <HeaderTitle>
                  {folders.find((f) => f.id === activeFolder)?.label}
                </HeaderTitle>
              </div>
              <SyncIndicator synced={isSynced}>
                <SyncDot synced={isSynced} />
                {isSynced ? 'Synced' : 'Syncing...'}
              </SyncIndicator>
            </HeaderBar>

            <MessagesList>
              {filteredMessages.length === 0 ? (
                <EmptyState>
                  <EmptyStateIcon>📭</EmptyStateIcon>
                  <EmptyStateText>No messages</EmptyStateText>
                  <EmptyStateSubtext>
                    Your messages will appear here
                  </EmptyStateSubtext>
                </EmptyState>
              ) : (
                filteredMessages.map((message) => (
                  <MessageCard key={message.id} unread={message.unread}>
                    <MessageFrom>
                      <span>{message.fromName}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#a4adb8',
                          fontWeight: 'normal',
                        }}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </MessageFrom>
                    <MessageSubject>{message.subject}</MessageSubject>
                    <MessagePreview>{message.preview}</MessagePreview>
                    <div style={{ marginTop: '8px', fontSize: '11px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          background:
                            message.channel === 'email'
                              ? '#dbeafe'
                              : '#dcfce7',
                          color:
                            message.channel === 'email'
                              ? '#0c4a6e'
                              : '#166534',
                          borderRadius: '3px',
                          fontWeight: '500',
                        }}
                      >
                        {message.channel === 'email' ? '✉️ Email' : '📱 SMS'}
                      </span>
                    </div>
                  </MessageCard>
                ))
              )}
            </MessagesList>
          </ContentArea>
        </MainContent>

        {showCompose && (
          <ComposeModal onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseCompose();
          }}>
            <ComposeForm>
              <FormHeader>
                <h3 style={{ margin: 0 }}>Compose Message</h3>
                <button
                  onClick={handleCloseCompose}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#a4adb8',
                  }}
                >
                  ✕
                </button>
              </FormHeader>

              <FormBody>
                <FormField>
                  <FormLabel>Channel</FormLabel>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="channel"
                        value="email"
                        checked={composeData.channel === 'email'}
                        onChange={(e) =>
                          setComposeData({
                            ...composeData,
                            channel: e.target.value as 'email' | 'sms',
                          })
                        }
                      />
                      Email
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="channel"
                        value="sms"
                        checked={composeData.channel === 'sms'}
                        onChange={(e) =>
                          setComposeData({
                            ...composeData,
                            channel: e.target.value as 'email' | 'sms',
                          })
                        }
                      />
                      SMS
                    </label>
                  </div>
                </FormField>

                <FormField>
                  <FormLabel>To</FormLabel>
                  <FormInput
                    type={composeData.channel === 'sms' ? 'tel' : 'email'}
                    placeholder={
                      composeData.channel === 'sms'
                        ? 'Enter phone number'
                        : 'Enter email address'
                    }
                    value={composeData.to}
                    onChange={(e) =>
                      setComposeData({ ...composeData, to: e.target.value })
                    }
                  />
                </FormField>

                {composeData.channel === 'email' && (
                  <FormField>
                    <FormLabel>Subject</FormLabel>
                    <FormInput
                      type="text"
                      placeholder="Enter subject"
                      value={composeData.subject}
                      onChange={(e) =>
                        setComposeData({ ...composeData, subject: e.target.value })
                      }
                    />
                  </FormField>
                )}

                <FormField>
                  <FormLabel>Message</FormLabel>
                  <FormTextArea
                    placeholder={
                      composeData.channel === 'sms'
                        ? 'Enter your message (160 characters max)'
                        : 'Enter your message'
                    }
                    value={composeData.body}
                    maxLength={composeData.channel === 'sms' ? 160 : undefined}
                    onChange={(e) =>
                      setComposeData({ ...composeData, body: e.target.value })
                    }
                  />
                  {composeData.channel === 'sms' && (
                    <div style={{ fontSize: '12px', color: '#a4adb8' }}>
                      {composeData.body.length}/160 characters
                    </div>
                  )}
                </FormField>

                <ScheduleSection>
                  <ScheduleToggle
                    type="checkbox"
                    id="schedule"
                    checked={scheduleEmail}
                    onChange={(e) => setScheduleEmail(e.target.checked)}
                  />
                  <ScheduleLabel htmlFor="schedule">
                    <IconClock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Schedule message
                  </ScheduleLabel>
                  {scheduleEmail && (
                    <ScheduleTime
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  )}
                </ScheduleSection>
              </FormBody>

              <FormFooter>
                <Button variant="secondary" onClick={handleCloseCompose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSendEmail}>
                  <IconSend size={16} />
                  {scheduleEmail ? 'Schedule' : 'Send'}
                </Button>
              </FormFooter>
            </ComposeForm>
          </ComposeModal>
        )}
      </MessagingContainer>
    </PageContainer>
  );
};
