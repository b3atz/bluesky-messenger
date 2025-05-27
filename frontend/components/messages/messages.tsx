'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Messages.module.css';

// Define types for better TypeScript support
interface KeyPair {
  publicKey: string;
  secretKey: string;
}

interface EncryptedContent {
  nonce: string;
  message: string;
  publicKey: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  encryptedContent: EncryptedContent;
  timestamp: string;
  isDelivered: boolean;
  isRead: boolean;
  conversationId: string;
}

interface LastMessage {
  text: string;
  timestamp: string;
  isEncrypted: boolean;
}

interface Conversation {
  id: string;
  participantDid: string;
  participantHandle: string;
  lastMessage?: LastMessage;
  unreadCount: number;
}

// Function to generate encryption keys (in a real app, you'd use a robust crypto library)
const generateKeyPair = async (): Promise<KeyPair | null> => {
  try {
    // Import the nacl library
    const nacl = await import('tweetnacl');
    const keypair = nacl.box.keyPair();

    // Convert Uint8Array to strings for storage
    return {
      publicKey: Buffer.from(keypair.publicKey).toString('hex'),
      secretKey: Buffer.from(keypair.secretKey).toString('hex')
    };
  } catch (error) {
    console.error('Error generating keys:', error);
    return null;
  }
};

const Messages = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recipientDid, setRecipientDid] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      // Simulate loading for animation
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

  // Generate encryption keys if they don't exist
  useEffect(() => {
    const initKeys = async () => {
      // Check if keys already exist in localStorage
      const storedKeys = localStorage.getItem('encryption_keys');
      if (storedKeys) {
        setKeyPair(JSON.parse(storedKeys));
      } else {
        // Generate new keys
        const newKeyPair = await generateKeyPair();
        if (newKeyPair) {
          localStorage.setItem('encryption_keys', JSON.stringify(newKeyPair));
          setKeyPair(newKeyPair);
        }
      }
    };

    if (isAuthenticated) {
      initKeys();
      // Fetch conversations
      fetchConversations();
    }
  }, [isAuthenticated]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch conversations from the server
  const fetchConversations = async () => {
    try {
      setIsLoading(true);

      // Mock data for demonstration
      const mockConversations: Conversation[] = [
        {
          id: '1',
          participantDid: 'did:plc:abcdefg123456',
          participantHandle: 'alice.bsky.social',
          lastMessage: {
            text: 'Hey, how are you doing?',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            isEncrypted: true
          },
          unreadCount: 2
        },
        {
          id: '2',
          participantDid: 'did:plc:hijklmn789012',
          participantHandle: 'bob.bsky.social',
          lastMessage: {
            text: 'Did you see the latest post?',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            isEncrypted: true
          },
          unreadCount: 0
        },
        {
          id: '3',
          participantDid: 'did:plc:opqrstu345678',
          participantHandle: 'charlie.bsky.social',
          lastMessage: {
            text: 'Thanks for sharing that article!',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            isEncrypted: true
          },
          unreadCount: 0
        }
      ];

      setConversations(mockConversations);

      // In a real app, you would fetch from your server:
      // const response = await fetch('http://localhost:3001/messages', {
      //   credentials: 'include',
      // });
      // 
      // if (response.ok) {
      //   const data = await response.json();
      //   setConversations(data.conversations || []);
      // } else {
      //   console.error('Failed to fetch conversations');
      // }

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setIsLoading(false);
    }
  };

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);

    try {
      // Mock data for demonstration
      const mockMessages: Message[] = [
        {
          id: '101',
          senderId: 'did:plc:abcdefg123456',
          receiverId: user?.did || '',
          conversationId: '1',
          encryptedContent: {
            nonce: 'nonce1',
            message: 'Hello there!',
            publicKey: 'pubkey1'
          },
          timestamp: new Date(Date.now() - 3700000).toISOString(),
          isDelivered: true,
          isRead: false
        },
        {
          id: '102',
          senderId: user?.did || '',
          receiverId: 'did:plc:abcdefg123456',
          conversationId: '1',
          encryptedContent: {
            nonce: 'nonce2',
            message: 'Hi! How are you?',
            publicKey: 'pubkey2'
          },
          timestamp: new Date(Date.now() - 3650000).toISOString(),
          isDelivered: true,
          isRead: true
        },
        {
          id: '103',
          senderId: 'did:plc:abcdefg123456',
          receiverId: user?.did || '',
          conversationId: '1',
          encryptedContent: {
            nonce: 'nonce3',
            message: 'I\'m doing well, thanks for asking! How about you?',
            publicKey: 'pubkey3'
          },
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          isDelivered: true,
          isRead: false
        }
      ];

      // Filter messages for the selected conversation
      const conversationMessages = mockMessages.filter(msg => msg.conversationId === conversationId);
      setMessages(conversationMessages);

      // In a real app, you would fetch from your server:
      // const response = await fetch(`http://localhost:3001/messages/conversations/${conversationId}`, {
      //   credentials: 'include',
      // });
      // 
      // if (response.ok) {
      //   const data = await response.json();
      //   setMessages(data.messages || []);
      // } else {
      //   console.error('Failed to fetch messages');
      // }

    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Select a conversation
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  // Simple "encryption" (in a real app, use proper end-to-end encryption)
  const encryptMessage = (message: string, recipientPublicKey: string): EncryptedContent => {
    // For demo purposes, we're just creating a simple encrypted structure
    // In a real app, use proper encryption with the recipient's public key
    return {
      nonce: 'demo-nonce',
      message: Buffer.from(message).toString('base64'),
      publicKey: keyPair?.publicKey || '',
    };
  };

  // Send a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || (!selectedConversation && !recipientDid)) {
      return;
    }

    try {
      // Encrypt message (in a real app, get recipient's public key first)
      const encryptedContent = encryptMessage(newMessage, 'recipient-public-key');

      // Create a new message object
      const newMessageObj: Message = {
        id: `msg-${Date.now()}`,
        senderId: user?.did || '',
        receiverId: selectedConversation ? selectedConversation.participantDid : recipientDid,
        conversationId: selectedConversation?.id || 'new',
        encryptedContent,
        timestamp: new Date().toISOString(),
        isDelivered: false,
        isRead: false
      };

      // Add message to the UI immediately
      setMessages(prev => [...prev, newMessageObj]);

      // Clear the input
      setNewMessage('');

      // In a real app, you would send to your server:
      // const response = await fetch('http://localhost:3001/messages/send', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     receiverId: selectedConversation ? selectedConversation.participantDid : recipientDid,
      //     encryptedContent,
      //   }),
      //   credentials: 'include',
      // });

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>
          <svg className={styles.loadingCircle} viewBox="0 0 50 50">
            <circle className={styles.loadingPath} cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
          </svg>
        </div>
        <p className={styles.loadingText}>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Sidebar with conversations */}
      <div className={`${styles.sidebar} ${showSidebar ? styles.sidebarVisible : styles.sidebarHidden}`}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Messages</h2>
          <div className={styles.sidebarUser}>
            <div className={styles.avatar}>{user?.handle?.[0]?.toUpperCase() || '?'}</div>
            <span className={styles.username}>{user?.handle || 'User'}</span>
            <button className={styles.logoutButton} onClick={handleLogout}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.logoutIcon}>
                <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* New conversation input */}
        <div className={styles.newConversation}>
          <input
            type="text"
            placeholder="Enter recipient DID"
            value={recipientDid}
            onChange={(e) => setRecipientDid(e.target.value)}
            className={styles.recipientInput}
          />
          <button
            onClick={() => {
              if (recipientDid) {
                setSelectedConversation(null);
                setMessages([]);
              }
            }}
            className={styles.newButton}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.newButtonIcon}>
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
          </button>
        </div>

        {/* Conversations list */}
        <div className={styles.conversationsList}>
          {conversations.length === 0 ? (
            <div className={styles.noConversations}>
              No conversations yet
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={`${styles.conversationItem} ${selectedConversation?.id === conversation.id ? styles.activeConversation : ''
                  }`}
              >
                <div className={styles.conversationAvatar}>
                  {conversation.participantHandle[0].toUpperCase()}
                </div>
                <div className={styles.conversationDetails}>
                  <div className={styles.conversationHeader}>
                    <span className={styles.conversationName}>{conversation.participantHandle}</span>
                    {conversation.lastMessage && (
                      <span className={styles.conversationTime}>
                        {formatTime(conversation.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  {conversation.lastMessage && (
                    <div className={styles.conversationPreview}>
                      {conversation.lastMessage.isEncrypted ? '🔒 ' : ''}
                      {conversation.lastMessage.text}
                    </div>
                  )}
                </div>
                {conversation.unreadCount > 0 && (
                  <div className={styles.unreadBadge}>{conversation.unreadCount}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile toggle for sidebar */}
      <button
        className={styles.sidebarToggle}
        onClick={() => setShowSidebar(!showSidebar)}
      >
        {showSidebar ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.toggleIcon}>
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.toggleIcon}>
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Chat area */}
      <div className={styles.chatArea}>
        {/* Chat header */}
        <div className={styles.chatHeader}>
          {selectedConversation ? (
            <>
              <div className={styles.chatAvatar}>
                {selectedConversation.participantHandle[0].toUpperCase()}
              </div>
              <h2 className={styles.chatTitle}>
                {selectedConversation.participantHandle}
              </h2>
            </>
          ) : recipientDid ? (
            <>
              <div className={styles.chatAvatar}>?</div>
              <h2 className={styles.chatTitle}>New Message</h2>
            </>
          ) : (
            <h2 className={styles.chatTitle}>Select a conversation</h2>
          )}
        </div>

        {/* Messages */}
        <div className={styles.messagesContainer}>
          {loadingMessages ? (
            <div className={styles.messagesLoading}>
              <div className={styles.loadingSpinner}>
                <svg className={styles.loadingCircle} viewBox="0 0 50 50">
                  <circle className={styles.loadingPath} cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
                </svg>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className={styles.noMessages}>
              {selectedConversation || recipientDid
                ? 'No messages yet. Start the conversation!'
                : 'Select a conversation to see messages'}
            </div>
          ) : (
            <div className={styles.messagesList}>
              {messages.map((message, index) => {
                const isCurrentUser = message.senderId === user?.did;
                const showDate = index === 0 ||
                  formatDate(messages[index - 1].timestamp) !== formatDate(message.timestamp);

                return (
                  <div key={message.id} className={styles.messageGroup}>
                    {showDate && (
                      <div className={styles.dateHeader}>
                        {formatDate(message.timestamp)}
                      </div>
                    )}
                    <div
                      className={`${styles.messageItem} ${isCurrentUser ? styles.sentMessage : styles.receivedMessage
                        }`}
                    >
                      <div className={styles.messageContent}>
                        <p className={styles.messageText}>
                          {message.encryptedContent.message}
                        </p>
                        <div className={styles.messageTime}>
                          {formatTime(message.timestamp)}
                          {isCurrentUser && (
                            <span className={styles.messageStatus}>
                              {message.isRead ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.readIcon}>
                                  <path d="M10 2a.75.75 0 01.75.75v5.59l1.95-2.1a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0L6.2 7.26a.75.75 0 111.1-1.02l1.95 2.1V2.75A.75.75 0 0110 2z" />
                                  <path d="M10 15a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5z" />
                                </svg>
                              ) : message.isDelivered ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.deliveredIcon}>
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.sentIcon}>
                                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        {(selectedConversation || recipientDid) && (
          <div className={styles.messageInput}>
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className={styles.messageTextField}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className={styles.sendButton}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.sendIcon}>
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;