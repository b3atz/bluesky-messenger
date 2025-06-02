'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  senderHandle?: string;
  receiverId: string;
  receiverHandle?: string;
  encryptedContent: EncryptedContent;
  timestamp: string;
  isDelivered: boolean;
  isRead: boolean;
  conversationId: string;
  plaintext?: string;
  isNew?: boolean;
  isOptimistic?: boolean; // Track optimistic messages
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

// Backend API URL - make sure this matches your backend server
const API_URL = 'http://localhost:3001';

// Connection status type
type ConnectionStatus = 'connecting' | 'connected' | 'failed';

// DID to handle mapping for known accounts
const didToHandle: Record<string, string> = {
  'did:plc:aaronbernardtest': 'aaronbernardtest.bsky.social',
  'did:plc:aaronberdev': 'aaronberdev.bsky.social',
};

// Helper functions for DIDs and handles
const isDID = (str: string): boolean => {
  return str.startsWith('did:');
};

const formatHandle = (handle: string): string => {
  let formatted = handle.trim().replace(/^@/, '');
  if (!formatted.includes('.')) {
    formatted = `${formatted}.bsky.social`;
  }
  return formatted;
};

const formatDIDForDisplay = (did: string): string => {
  if (!isDID(did)) return did;

  for (const [didPrefix, handle] of Object.entries(didToHandle)) {
    if (did.startsWith(didPrefix)) {
      return handle;
    }
  }

  if (did.startsWith('did:plc:')) {
    return did.replace('did:plc:', '').substring(0, 8) + '...';
  }

  if (did.startsWith('did:web:')) {
    return did.replace('did:web:', '');
  }

  return did.substring(0, 12) + '...';
};

// Helper function to check if messages are duplicates
const isDuplicateMessage = (msg1: Message, msg2: Message): boolean => {
  // Check if they have the same content, sender, recipient, and similar timestamps
  const timeDiff = Math.abs(new Date(msg1.timestamp).getTime() - new Date(msg2.timestamp).getTime());

  return (
    msg1.senderId === msg2.senderId &&
    msg1.receiverId === msg2.receiverId &&
    msg1.plaintext === msg2.plaintext &&
    timeDiff < 10000 // Within 10 seconds
  );
};

// Function to generate encryption keys
const generateKeyPair = async (): Promise<KeyPair | null> => {
  try {
    const nacl = await import('tweetnacl');
    const keypair = nacl.box.keyPair();

    return {
      publicKey: Buffer.from(keypair.publicKey).toString('hex'),
      secretKey: Buffer.from(keypair.secretKey).toString('hex')
    };
  } catch (error) {
    console.error('Error generating keys:', error);
    return null;
  }
};

// Simple decryption function for demo
const decryptMessage = (encryptedMessage: string): string => {
  try {
    if (encryptedMessage.includes('base64') || !encryptedMessage.includes(' ')) {
      return Buffer.from(encryptedMessage, 'base64').toString('utf8');
    }
    return encryptedMessage;
  } catch {
    return encryptedMessage;
  }
};

// Function to resolve Bluesky handle to DID
const resolveHandleToDid = async (handle: string, agent: any): Promise<string | null> => {
  try {
    let cleanHandle = handle.replace('@', '');
    if (!cleanHandle.includes('.')) {
      cleanHandle = `${cleanHandle}.bsky.social`;
    }

    console.log('Resolving handle:', cleanHandle);

    const response = await agent.getProfile({ actor: cleanHandle });
    if (response.success && response.data.did) {
      console.log('Resolved DID:', response.data.did);
      return response.data.did;
    }
    return null;
  } catch (error) {
    console.error('Error resolving handle:', error);
    return null;
  }
};

// Create a demo conversation for testing
const createDemoConversation = (userDid: string, userHandle: string = 'you'): { conversations: Conversation[], messages: Message[] } => {
  const demoHandle = 'demo.user.bsky.social';
  const demoDid = 'did:plc:demo1234567890';

  const demoConversation: Conversation = {
    id: 'demo-conv-1',
    participantDid: demoDid,
    participantHandle: demoHandle,
    lastMessage: {
      text: 'Welcome to the encrypted messenger!',
      timestamp: new Date().toISOString(),
      isEncrypted: true
    },
    unreadCount: 1
  };

  const demoMessage: Message = {
    id: 'demo-msg-1',
    senderId: demoDid,
    senderHandle: demoHandle,
    receiverId: userDid,
    receiverHandle: userHandle,
    conversationId: 'demo-conv-1',
    encryptedContent: {
      nonce: 'demo-nonce',
      message: Buffer.from('Welcome to the encrypted messenger! This is a demo message.').toString('base64'),
      publicKey: 'demo-public-key'
    },
    timestamp: new Date().toISOString(),
    isDelivered: true,
    isRead: false,
    plaintext: 'Welcome to the encrypted messenger! This is a demo message.'
  };

  return {
    conversations: [demoConversation],
    messages: [demoMessage]
  };
};

// Main Messages Component
const Messages = () => {
  const { isAuthenticated, user, logout, agent } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recipientHandle, setRecipientHandle] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [backendStatus, setBackendStatus] = useState<ConnectionStatus>('connecting');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Real-time polling states
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastPolledTimestamp = useRef<string>('');

  // Delete conversation states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState<Conversation | null>(null);

  // Add debug logging
  const logDebug = (message: string) => {
    console.log(message);
    setDebugInfo(prev => `${new Date().toISOString().substring(11, 19)} - ${message}\n${prev}`);
  };

  // Navigation handler for going back to hub
  const handleGoToHub = () => {
    logDebug('Navigating to hub...');
    router.push('/hub');
  };

  // Fixed polling function that prevents duplicates
  const pollForNewMessages = useCallback(async () => {
    if (backendStatus !== 'connected' || !isAuthenticated || !user?.did) {
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/dm', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const backendData = await response.json();

        if (Array.isArray(backendData) && backendData.length > 0) {
          let hasNewMessages = false;
          const newMessages: Message[] = [];
          const updatedConversations: Conversation[] = [];

          for (const backendConv of backendData) {
            const existingConv = conversations.find(c => c.id === backendConv.id);

            // Check if conversation has new messages
            const hasNewContent = !existingConv ||
              (backendConv.lastMessage &&
                (!existingConv.lastMessage ||
                  new Date(backendConv.lastMessage.timestamp) > new Date(existingConv.lastMessage.timestamp)));

            if (hasNewContent) {
              // Fetch messages for this conversation
              try {
                const messagesResponse = await fetch(`http://localhost:3001/dm/${backendConv.participantDid}`, {
                  credentials: 'include',
                  headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                  }
                });

                if (messagesResponse.ok) {
                  const conversationMessages = await messagesResponse.json();

                  // Find new messages - compare against ALL existing messages, not just for this conversation
                  const existingMessageIds = new Set(allMessages.map(m => m.id));
                  const existingOptimisticMessages = allMessages.filter(m => m.isOptimistic);

                  const newMessagesForConv = conversationMessages
                    .filter((backendMsg: any) => {
                      // Skip if we already have this message ID
                      if (existingMessageIds.has(backendMsg.id)) {
                        return false;
                      }

                      // Check for duplicate optimistic messages
                      const isDuplicate = existingOptimisticMessages.some(optMsg =>
                        isDuplicateMessage({
                          ...optMsg,
                          id: backendMsg.id // Use backend ID for comparison
                        }, {
                          id: backendMsg.id,
                          senderId: backendMsg.from,
                          receiverId: backendMsg.to,
                          plaintext: backendMsg.content,
                          timestamp: backendMsg.timestamp
                        } as Message)
                      );

                      return !isDuplicate;
                    })
                    .map((backendMsg: any) => ({
                      id: backendMsg.id,
                      senderId: backendMsg.from,
                      senderHandle: backendMsg.senderHandle || formatDIDForDisplay(backendMsg.from),
                      receiverId: backendMsg.to,
                      receiverHandle: backendMsg.recipientHandle || formatDIDForDisplay(backendMsg.to),
                      conversationId: backendConv.id,
                      encryptedContent: {
                        nonce: 'backend-nonce',
                        message: Buffer.from(backendMsg.content).toString('base64'),
                        publicKey: keyPair?.publicKey || ''
                      },
                      timestamp: backendMsg.timestamp,
                      isDelivered: true,
                      isRead: false,
                      plaintext: backendMsg.content,
                      isNew: true // Mark as new for animation
                    } as Message));

                  if (newMessagesForConv.length > 0) {
                    newMessages.push(...newMessagesForConv);
                    hasNewMessages = true;

                    // Mark for animation
                    newMessagesForConv.forEach(msg => {
                      setNewMessageIds(prev => new Set([...Array.from(prev), msg.id]));
                    });

                    logDebug(`📨 Found ${newMessagesForConv.length} new messages`);

                    // Replace optimistic messages with real ones
                    setAllMessages(prev => {
                      let updated = [...prev];

                      // Remove optimistic messages that match new real messages
                      newMessagesForConv.forEach(realMsg => {
                        updated = updated.filter(msg => {
                          if (msg.isOptimistic && isDuplicateMessage(msg, realMsg)) {
                            logDebug(`🔄 Replacing optimistic message ${msg.id} with real message ${realMsg.id}`);
                            return false;
                          }
                          return true;
                        });
                      });

                      return updated;
                    });
                  }
                }
              } catch (msgError) {
                console.error('Error fetching messages:', msgError);
              }
            }

            // Add updated conversation
            updatedConversations.push({
              id: backendConv.id,
              participantDid: backendConv.participantDid,
              participantHandle: backendConv.participantHandle,
              lastMessage: backendConv.lastMessage ? {
                text: backendConv.lastMessage.text,
                timestamp: backendConv.lastMessage.timestamp,
                isEncrypted: backendConv.lastMessage.isEncrypted || false
              } : undefined,
              unreadCount: backendConv.unreadCount || 0
            });
          }

          if (hasNewMessages) {
            // Update messages - add new messages to existing ones
            setAllMessages(prev => [...prev, ...newMessages]);

            // Update conversations
            setConversations(updatedConversations);

            // Save to localStorage
            saveToLocalStorage(updatedConversations, [...allMessages, ...newMessages]);

            // Auto-scroll if viewing conversation with new messages
            if (selectedConversation && newMessages.some(m => m.conversationId === selectedConversation.id)) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }

            // Show notification for new messages from others
            const newMessagesFromOthers = newMessages.filter(m => m.senderId !== user?.did);
            if (newMessagesFromOthers.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
              const latestMessage = newMessagesFromOthers[0];
              new Notification('New Message', {
                body: `${latestMessage.senderHandle}: ${latestMessage.plaintext?.substring(0, 50)}${latestMessage.plaintext && latestMessage.plaintext.length > 50 ? '...' : ''}`,
                icon: '/favicon.ico'
              });
            }
          }
        }
      }
    } catch (error) {
      logDebug(`Polling error: ${error}`);
    }
  }, [backendStatus, isAuthenticated, user?.did, conversations, allMessages, selectedConversation, keyPair]);

  // Clear animation markers
  useEffect(() => {
    if (newMessageIds.size > 0) {
      const timer = setTimeout(() => {
        setNewMessageIds(new Set());
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [newMessageIds]);

  // Start/stop polling
  useEffect(() => {
    if (backendStatus === 'connected' && isAuthenticated) {
      pollingRef.current = setInterval(pollForNewMessages, 2000); // Poll every 2 seconds
      logDebug('🔄 Started real-time polling');

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          logDebug('⏹️ Stopped real-time polling');
        }
      };
    }
  }, [backendStatus, isAuthenticated, pollForNewMessages]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          logDebug('📢 Notification permission granted');
        }
      });
    }
  }, []);

  // Helper function to get the correct display name for conversations
  const getConversationDisplayName = (conversation: Conversation): string => {
    if (conversation.participantHandle &&
      conversation.participantHandle.includes('.') &&
      !conversation.participantHandle.includes('...')) {
      return conversation.participantHandle;
    }

    for (const [didPrefix, handle] of Object.entries(didToHandle)) {
      if (conversation.participantDid.startsWith(didPrefix)) {
        return handle;
      }
    }

    if (!user || conversation.participantDid !== user.did) {
      if (conversation.participantHandle.startsWith('did:') ||
        conversation.participantHandle.includes('...')) {

        const messages = allMessages.filter(msg => msg.conversationId === conversation.id);
        for (const msg of messages) {
          if (msg.senderId === conversation.participantDid && msg.senderHandle && msg.senderHandle.includes('.')) {
            return msg.senderHandle;
          }
          if (msg.receiverId === conversation.participantDid && msg.receiverHandle && msg.receiverHandle.includes('.')) {
            return msg.receiverHandle;
          }
        }
      }

      if (isDID(conversation.participantDid)) {
        return formatDIDForDisplay(conversation.participantDid);
      }

      return conversation.participantHandle;
    }

    const messages = allMessages.filter(msg => msg.conversationId === conversation.id);
    if (messages.length > 0) {
      for (const msg of messages) {
        if (msg.senderId !== user.did && msg.senderHandle && msg.senderHandle.includes('.')) {
          return msg.senderHandle;
        }
        if (msg.receiverId !== user.did && msg.receiverHandle && msg.receiverHandle.includes('.')) {
          return msg.receiverHandle;
        }
      }

      const firstMsg = messages[0];
      if (firstMsg.senderId !== user.did) {
        return firstMsg.senderHandle || formatDIDForDisplay(firstMsg.senderId);
      } else if (firstMsg.receiverId !== user.did) {
        return firstMsg.receiverHandle || formatDIDForDisplay(firstMsg.receiverId);
      }
    }

    if (isDID(conversation.participantHandle)) {
      return formatDIDForDisplay(conversation.participantHandle);
    }

    return conversation.participantHandle;
  };

  // Check backend health
  const checkBackendHealth = async () => {
    try {
      logDebug('Checking backend health...');
      setBackendStatus('connecting');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_URL}/health`, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        logDebug('Backend is healthy and connected');
        setBackendStatus('connected');
      } else {
        logDebug(`Backend health check failed: ${response.status} ${response.statusText}`);
        setBackendStatus('failed');
      }
    } catch (error) {
      try {
        logDebug('Health endpoint failed, trying direct connection...');
        const fallbackResponse = await fetch(`${API_URL}/`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(2000)
        });

        if (fallbackResponse.ok || fallbackResponse.status === 404) {
          logDebug('Backend is connected (fallback check)');
          setBackendStatus('connected');
        } else {
          logDebug(`Backend fallback check failed: ${fallbackResponse.status}`);
          setBackendStatus('failed');
        }
      } catch (fallbackError) {
        logDebug(`Backend connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setBackendStatus('failed');
      }
    }
  };

  // Function to initiate delete conversation
  const deleteConversation = (conversationId: string) => {
    const convoToDelete = conversations.find(c => c.id === conversationId);
    if (convoToDelete) {
      setDeletingConversation(convoToDelete);
      setConfirmDeleteId(conversationId);
    }
  };

  // Function to handle confirmed deletion
  const handleConfirmDelete = () => {
    if (!confirmDeleteId) return;

    logDebug(`Deleting conversation: ${confirmDeleteId}`);

    const updatedConversations = conversations.filter(conv => conv.id !== confirmDeleteId);
    const updatedMessages = allMessages.filter(msg => msg.conversationId !== confirmDeleteId);

    if (selectedConversation?.id === confirmDeleteId) {
      setSelectedConversation(null);
    }

    setConversations(updatedConversations);
    setAllMessages(updatedMessages);
    saveToLocalStorage(updatedConversations, updatedMessages);

    if (backendStatus === 'connected') {
      try {
        fetch(`${API_URL}/dm/${confirmDeleteId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
          .then(response => {
            if (response.ok) {
              logDebug(`Successfully deleted conversation ${confirmDeleteId} from backend`);
            } else {
              logDebug(`Failed to delete conversation ${confirmDeleteId} from backend: ${response.status}`);
            }
          })
          .catch(error => {
            logDebug(`Error deleting conversation from backend: ${error}`);
          });
      } catch (error) {
        logDebug(`Error initiating backend deletion: ${error}`);
      }
    }

    setConfirmDeleteId(null);
    setDeletingConversation(null);
    logDebug(`Conversation ${confirmDeleteId} deleted successfully`);
  };

  // Function to cancel deletion
  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
    setDeletingConversation(null);
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      logDebug(`Authenticated as: ${user?.handle || 'unknown'}`);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router, user]);

  // Check backend connection periodically
  useEffect(() => {
    checkBackendHealth();
    const intervalId = setInterval(() => {
      checkBackendHealth();
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Generate encryption keys if they don't exist
  useEffect(() => {
    const initKeys = async () => {
      const storedKeys = localStorage.getItem('encryption_keys');
      if (storedKeys) {
        setKeyPair(JSON.parse(storedKeys));
        logDebug('Loaded existing encryption keys');
      } else {
        logDebug('Generating new encryption keys...');
        const newKeyPair = await generateKeyPair();
        if (newKeyPair) {
          localStorage.setItem('encryption_keys', JSON.stringify(newKeyPair));
          setKeyPair(newKeyPair);
          logDebug('Generated and stored new encryption keys');
        } else {
          logDebug('ERROR: Failed to generate encryption keys');
        }
      }
    };

    if (isAuthenticated) {
      initKeys();
      fetchConversationsAndMessages();
    }
  }, [isAuthenticated]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation, allMessages]);

  // Get messages for current conversation
  const getMessagesForConversation = (conversationId: string) => {
    return allMessages.filter(msg => msg.conversationId === conversationId);
  };

  // Fetch conversations and messages from backend
  const fetchConversationsAndMessages = async () => {
    try {
      setIsLoading(true);
      logDebug('📥 Fetching conversations and messages...');

      if (backendStatus === 'connected' || backendStatus === 'connecting') {
        try {
          logDebug('🌐 Attempting to fetch from backend server...');

          const response = await fetch('http://localhost:3001/dm', {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });

          if (response.ok) {
            const backendData = await response.json();
            setBackendStatus('connected');

            if (Array.isArray(backendData) && backendData.length > 0) {
              logDebug('🔄 Processing backend conversations...');

              const processedConversations: Conversation[] = backendData.map(backendConv => ({
                id: backendConv.id,
                participantDid: backendConv.participantDid,
                participantHandle: backendConv.participantHandle,
                lastMessage: backendConv.lastMessage ? {
                  text: backendConv.lastMessage.text,
                  timestamp: backendConv.lastMessage.timestamp,
                  isEncrypted: backendConv.lastMessage.isEncrypted || false
                } : undefined,
                unreadCount: backendConv.unreadCount || 0
              }));

              const allBackendMessages: Message[] = [];

              for (const conv of processedConversations) {
                try {
                  const messagesResponse = await fetch(`http://localhost:3001/dm/${conv.participantDid}`, {
                    credentials: 'include',
                    headers: {
                      'Accept': 'application/json',
                      'Cache-Control': 'no-cache'
                    }
                  });

                  if (messagesResponse.ok) {
                    const conversationMessages = await messagesResponse.json();
                    logDebug(`📨 Fetched ${conversationMessages.length} messages for conversation ${conv.id}`);

                    const processedMessages: Message[] = conversationMessages.map((backendMsg: any) => ({
                      id: backendMsg.id,
                      senderId: backendMsg.from,
                      senderHandle: backendMsg.senderHandle || formatDIDForDisplay(backendMsg.from),
                      receiverId: backendMsg.to,
                      receiverHandle: backendMsg.recipientHandle || formatDIDForDisplay(backendMsg.to),
                      conversationId: conv.id,
                      encryptedContent: {
                        nonce: 'backend-nonce',
                        message: Buffer.from(backendMsg.content).toString('base64'),
                        publicKey: keyPair?.publicKey || ''
                      },
                      timestamp: backendMsg.timestamp,
                      isDelivered: true,
                      isRead: false,
                      plaintext: backendMsg.content
                    }));

                    allBackendMessages.push(...processedMessages);
                  }
                } catch (msgError) {
                  // Handle message fetch error
                }
              }

              setConversations(processedConversations);
              setAllMessages(allBackendMessages);
              saveToLocalStorage(processedConversations, allBackendMessages);

              logDebug(`✅ Processed ${processedConversations.length} conversations and ${allBackendMessages.length} messages from backend`);
              setIsLoading(false);
              return;
            } else {
              logDebug('📦 No conversations found in backend, continuing with localStorage...');
            }
          } else {
            logDebug(`❌ Backend returned error: ${response.status} ${response.statusText}`);
            setBackendStatus('failed');
          }
        } catch (backendError) {
          logDebug(`💥 Backend connection failed: ${backendError instanceof Error ? backendError.message : 'Unknown error'}`);
          setBackendStatus('failed');
        }
      }

      // Load from localStorage as fallback
      const storedConversations = localStorage.getItem('bluesky_conversations');
      const storedMessages = localStorage.getItem('bluesky_messages');

      if (storedConversations && storedMessages) {
        const parsedConversations = JSON.parse(storedConversations);
        const parsedMessages = JSON.parse(storedMessages);

        setConversations(parsedConversations);
        setAllMessages(parsedMessages);
        logDebug(`📦 Loaded ${parsedConversations.length} conversations and ${parsedMessages.length} messages from localStorage`);
      } else {
        logDebug('🆕 No existing data found, creating demo data');

        if (user?.did) {
          const demoData = createDemoConversation(user.did, user.handle);
          setConversations(demoData.conversations);
          setAllMessages(demoData.messages);

          localStorage.setItem('bluesky_conversations', JSON.stringify(demoData.conversations));
          localStorage.setItem('bluesky_messages', JSON.stringify(demoData.messages));

          logDebug('✨ Created and saved demo conversation');
        } else {
          setConversations([]);
          setAllMessages([]);
          logDebug('⚠️ No user DID available, initialized with empty data');
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      logDebug(`💥 Error in fetchConversationsAndMessages: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  // Save conversations and messages to localStorage
  const saveToLocalStorage = (newConversations: Conversation[], newMessages: Message[]) => {
    localStorage.setItem('bluesky_conversations', JSON.stringify(newConversations));
    localStorage.setItem('bluesky_messages', JSON.stringify(newMessages));
    logDebug(`Saved to localStorage: ${newConversations.length} conversations and ${newMessages.length} messages`);
  };

  // Select a conversation
  const handleSelectConversation = (conversation: Conversation) => {
    if (conversation.participantHandle.includes('...') ||
      conversation.participantHandle.startsWith('did:') ||
      !conversation.participantHandle.includes('.')) {

      const fixedConversation = {
        ...conversation,
        participantHandle: getConversationDisplayName(conversation)
      };

      const updatedConversations = conversations.map(conv =>
        conv.id === conversation.id ? fixedConversation : conv
      );

      setConversations(updatedConversations);
      setSelectedConversation(fixedConversation);
      saveToLocalStorage(updatedConversations, allMessages);
      logDebug(`Selected and fixed conversation: ${fixedConversation.participantHandle}`);
    } else {
      setSelectedConversation(conversation);
      logDebug(`Selected conversation: ${conversation.participantHandle}`);
    }

    setRecipientHandle('');

    // Mark messages as read
    const updatedConversations = conversations.map(conv =>
      conv.id === conversation.id
        ? { ...conv, unreadCount: 0 }
        : conv
    );
    setConversations(updatedConversations);
    saveToLocalStorage(updatedConversations, allMessages);
  };

  // Simple "encryption" for demo
  const encryptMessage = (message: string): EncryptedContent => {
    return {
      nonce: crypto.randomUUID(),
      message: Buffer.from(message).toString('base64'),
      publicKey: keyPair?.publicKey || '',
    };
  };

  // Enhanced send message function with better duplicate prevention
  const handleSendMessage = async () => {
    if (!newMessage.trim() || (!selectedConversation && !recipientHandle.trim())) {
      return;
    }

    setSendingMessage(true);
    const trimmedRecipientHandle = recipientHandle.trim();
    const messageContent = newMessage.trim();
    logDebug(`Sending message to ${selectedConversation?.participantHandle || trimmedRecipientHandle}...`);

    try {
      let targetConversation = selectedConversation;
      let recipientDid = selectedConversation?.participantDid;
      let recipientHandleFormatted = selectedConversation?.participantHandle;

      if (!selectedConversation && trimmedRecipientHandle) {
        logDebug(`Creating new conversation with: ${trimmedRecipientHandle}`);

        let formattedHandle = formatHandle(trimmedRecipientHandle);
        recipientHandleFormatted = formattedHandle;

        if (!agent) {
          logDebug('No Bluesky agent available, using demo DID');
          recipientDid = `did:plc:${formattedHandle.replace(/\./g, '_')}`;
        } else {
          try {
            const resolvedDid = await resolveHandleToDid(formattedHandle, agent);
            if (resolvedDid) {
              recipientDid = resolvedDid;
              logDebug(`Resolved ${formattedHandle} to DID: ${recipientDid}`);
            } else {
              recipientDid = `did:plc:${formattedHandle.replace(/\./g, '_')}`;
              logDebug(`Could not resolve DID, using placeholder: ${recipientDid}`);
            }
          } catch (resolvingError) {
            recipientDid = `did:plc:${formattedHandle.replace(/\./g, '_')}`;
            logDebug(`Error resolving DID, using placeholder: ${recipientDid}`);
          }
        }

        const existingConv = conversations.find(conv =>
          conv.participantDid === recipientDid ||
          conv.participantHandle.toLowerCase() === formattedHandle.toLowerCase()
        );

        if (existingConv) {
          logDebug(`Conversation already exists, using existing conversation`);
          setSelectedConversation(existingConv);
          targetConversation = existingConv;
        } else {
          const newConversation: Conversation = {
            id: `conv-${Date.now()}`,
            participantDid: recipientDid,
            participantHandle: formattedHandle,
            lastMessage: {
              text: messageContent,
              timestamp: new Date().toISOString(),
              isEncrypted: true
            },
            unreadCount: 0
          };

          logDebug(`Created new conversation with ID: ${newConversation.id}`);
          const updatedConversations = [newConversation, ...conversations];
          setConversations(updatedConversations);
          setSelectedConversation(newConversation);
          targetConversation = newConversation;
        }
      }

      if (!targetConversation || !recipientDid) {
        logDebug('ERROR: No target conversation or recipient DID');
        setSendingMessage(false);
        return;
      }

      const encryptedContent = encryptMessage(messageContent);
      logDebug('Message encrypted successfully');

      // Create optimistic message (show immediately)
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}-${Math.random()}`,
        senderId: user?.did || '',
        senderHandle: user?.handle || '',
        receiverId: recipientDid,
        receiverHandle: recipientHandleFormatted,
        conversationId: targetConversation.id,
        encryptedContent,
        timestamp: new Date().toISOString(),
        isDelivered: false,
        isRead: false,
        plaintext: messageContent,
        isNew: true,
        isOptimistic: true // Mark as optimistic
      };

      logDebug(`Created optimistic message with ID: ${optimisticMessage.id}`);

      // Add optimistic message immediately
      setAllMessages(prev => [...prev, optimisticMessage]);
      setNewMessageIds(prev => new Set([...Array.from(prev), optimisticMessage.id]));

      // Update conversation
      const updatedConversations = conversations.map(conv =>
        conv.id === targetConversation!.id
          ? {
            ...conv,
            lastMessage: {
              text: messageContent,
              timestamp: new Date().toISOString(),
              isEncrypted: true
            }
          }
          : conv
      );

      if (!conversations.some(c => c.id === targetConversation.id)) {
        updatedConversations.unshift(targetConversation);
        logDebug(`Added new conversation to list`);
      }

      setConversations(updatedConversations);

      // Clear input immediately
      setNewMessage('');
      setRecipientHandle('');

      // Scroll to new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

      // Send to backend
      if (backendStatus === 'connected') {
        try {
          logDebug(`Sending message to backend server... recipientDid: ${recipientDid}`);

          const response = await fetch(`${API_URL}/dm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              recipientDid: recipientDid,
              content: messageContent,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            logDebug(`Message sent to backend successfully! Response: ${JSON.stringify(result)}`);

            // Replace optimistic message with real message info
            setAllMessages(prev => prev.map(msg =>
              msg.id === optimisticMessage.id
                ? {
                  ...msg,
                  id: result.messageId,
                  isDelivered: true,
                  isOptimistic: false
                }
                : msg
            ));

            saveToLocalStorage(updatedConversations, [...allMessages, optimisticMessage]);
          } else {
            const errorText = await response.text();
            logDebug(`Backend returned error: ${response.status} ${response.statusText} - ${errorText}`);

            // Remove optimistic message on error
            setAllMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
            setNewMessage(messageContent); // Restore message
          }
        } catch (backendError) {
          logDebug(`Error sending to backend: ${backendError instanceof Error ? backendError.message : 'Unknown error'}`);

          // Remove optimistic message on error
          setAllMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
          setNewMessage(messageContent); // Restore message
        }
      } else {
        logDebug(`Backend not connected (${backendStatus}), message stored locally only`);
        saveToLocalStorage(updatedConversations, [...allMessages, optimisticMessage]);
      }

      logDebug('Message sent successfully');

    } catch (error) {
      console.error('Error sending message:', error);
      logDebug(`Error in handleSendMessage: ${error instanceof Error ? error.message : 'Unknown error'}`);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLogout = async () => {
    try {
      logDebug('Logging out...');
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      logDebug(`Error in handleLogout: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const handleNewConversation = () => {
    if (recipientHandle.trim()) {
      setSelectedConversation(null);
      logDebug(`Starting new conversation with: ${recipientHandle}`);
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

  // Get current messages to display
  const currentMessages = selectedConversation
    ? getMessagesForConversation(selectedConversation.id)
    : [];

  return (
    <div className={styles.container}>
      {/* Sidebar with conversations */}
      <div className={`${styles.sidebar} ${showSidebar ? styles.sidebarVisible : styles.sidebarHidden}`}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>
            Messages
            <span className={`${styles.realTimeStatus} ${styles[backendStatus]}`}>
              <div className={styles.statusDot}></div>
              {backendStatus === 'connected' ? 'Live' : backendStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </h2>

          <div className={styles.sidebarUser}>
            <div className={styles.avatar}>{user?.handle?.[0]?.toUpperCase() || '?'}</div>
            <span className={styles.username}>{user?.handle || 'User'}</span>

            {/* Hub Navigation Button */}
            <button
              className={styles.hubButton || styles.logoutButton}
              onClick={handleGoToHub}
              title="Go to Hub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.hubIcon || styles.logoutIcon}>
                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 10v8a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 01-1 1H3a1 1 0 01-1-1v-8a1 1 0 01.293-.707l7-7z" clipRule="evenodd" />
              </svg>
            </button>

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
            placeholder="Enter Bluesky handle"
            value={recipientHandle}
            onChange={(e) => setRecipientHandle(e.target.value)}
            className={styles.recipientInput}
          />
          <button
            onClick={handleNewConversation}
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
              No conversations yet. Start by entering a Bluesky handle above!
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`${styles.conversationItem} ${selectedConversation?.id === conversation.id ? styles.activeConversation : ''}`}
              >
                <div
                  className={styles.conversationContent}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div className={styles.conversationAvatar}>
                    {getConversationDisplayName(conversation)[0].toUpperCase()}
                  </div>
                  <div className={styles.conversationDetails}>
                    <div className={styles.conversationHeader}>
                      <span className={styles.conversationName}>
                        {getConversationDisplayName(conversation)}
                      </span>
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation.id);
                  }}
                  className={styles.deleteButton}
                  title="Delete conversation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.deleteIcon}>
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
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
                {getConversationDisplayName(selectedConversation)[0].toUpperCase()}
              </div>
              <h2 className={styles.chatTitle}>
                {getConversationDisplayName(selectedConversation)}
              </h2>
            </>
          ) : recipientHandle ? (
            <>
              <div className={styles.chatAvatar}>?</div>
              <h2 className={styles.chatTitle}>New Message to @{recipientHandle}</h2>
            </>
          ) : (
            <h2 className={styles.chatTitle}>Select a conversation or start a new one</h2>
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
          ) : currentMessages.length === 0 && !recipientHandle ? (
            <div className={styles.noMessages}>
              Select a conversation to see messages or enter a Bluesky handle to start chatting!
            </div>
          ) : currentMessages.length === 0 && recipientHandle ? (
            <div className={styles.noMessages}>
              No messages yet. Start the conversation with @{recipientHandle}!
            </div>
          ) : (
            <div className={styles.messagesList}>
              {currentMessages.map((message, index) => {
                const isCurrentUser = message.senderId === user?.did;
                const showDate = index === 0 ||
                  formatDate(currentMessages[index - 1].timestamp) !== formatDate(message.timestamp);
                const isNewMessage = newMessageIds.has(message.id) || message.isNew;

                return (
                  <div key={message.id} className={styles.messageGroup}>
                    {showDate && (
                      <div className={styles.dateHeader} data-date={formatDate(message.timestamp)}>
                      </div>
                    )}
                    <div
                      className={`${styles.messageItem} ${isCurrentUser ? styles.sentMessage : styles.receivedMessage} ${isNewMessage ? styles.newMessage : ''}`}
                    >
                      <div className={styles.messageContent}>
                        <p className={styles.messageText}>
                          {message.plaintext || decryptMessage(message.encryptedContent.message)}
                          {message.isOptimistic && (
                            <span style={{ opacity: 0.6, fontSize: '0.7em', marginLeft: '0.5em' }}>
                              ⏳
                            </span>
                          )}
                        </p>
                        <div className={styles.messageTime}>
                          {formatTime(message.timestamp)}
                          {isCurrentUser && (
                            <span className={styles.messageStatus}>
                              {message.isRead ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.readIcon}>
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              ) : message.isDelivered ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.deliveredIcon}>
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.sentIcon}>
                                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.896 0 003.105 2.289z" />
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
        {(selectedConversation || recipientHandle) && (
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
              disabled={sendingMessage}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              className={styles.sendButton}
            >
              {sendingMessage ? (
                <svg className={styles.loadingSpinner} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className={styles.loadingCircle} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className={styles.loadingPath} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={styles.sendIcon}>
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.896 0 003.105 2.289z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDeleteId && deletingConversation && (
        <div className={styles.confirmDeleteDialog}>
          <div className={styles.confirmDeleteContent}>
            <h3 className={styles.confirmDeleteTitle}>Delete Conversation</h3>
            <p className={styles.confirmDeleteMessage}>
              Are you sure you want to delete your conversation with {getConversationDisplayName(deletingConversation)}? This cannot be undone.
            </p>
            <div className={styles.confirmDeleteButtons}>
              <button className={styles.cancelButton} onClick={handleCancelDelete}>
                Cancel
              </button>
              <button className={styles.confirmButton} onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;