'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

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
  const { isAuthenticated, user, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recipientDid, setRecipientDid] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

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

  // Fetch conversations from the server
  const fetchConversations = async () => {
    try {
      const response = await fetch('http://localhost:3001/messages', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        console.error('Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`http://localhost:3001/messages/conversations/${conversationId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        
        // Mark messages as read
        const unreadMessages = data.messages
          .filter((msg: Message) => !msg.isRead && msg.receiverId === user?.did)
          .map((msg: Message) => msg.id);
          
        if (unreadMessages.length > 0) {
          await fetch('http://localhost:3001/messages/mark-read', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messageIds: unreadMessages }),
            credentials: 'include',
          });
        }
      } else {
        console.error('Failed to fetch messages');
      }
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
      
      // Prepare request body
      const requestBody = {
        receiverId: selectedConversation ? selectedConversation.participantDid : recipientDid,
        encryptedContent,
      };
      
      // Send message to server
      const response = await fetch('http://localhost:3001/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewMessage('');
        
        // If this is a new conversation, refresh conversations list
        if (!selectedConversation) {
          await fetchConversations();
          // Select the new conversation
          const newConversation: Conversation = {
            id: data.conversationId,
            participantDid: recipientDid,
            participantHandle: recipientDid, // In a real app, fetch handle
            unreadCount: 0
          };
          handleSelectConversation(newConversation);
          setRecipientDid('');
        } else {
          // Refresh messages in the current conversation
          fetchMessages(selectedConversation.id);
        }
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar with conversations */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Messages</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user?.handle || 'Loading...'}
          </p>
        </div>
        
        {/* New conversation input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <input
              type="text"
              placeholder="Enter recipient DID"
              value={recipientDid}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientDid(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={() => {
                if (recipientDid) {
                  setSelectedConversation(null);
                  setMessages([]);
                }
              }}
              className="ml-2 px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
            >
              New
            </button>
          </div>
        </div>
        
        {/* Conversations list */}
        <div className="overflow-y-auto h-full pb-24">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No conversations yet
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer ${
                  selectedConversation?.id === conversation.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="font-medium text-gray-800 dark:text-white">
                  {conversation.participantHandle}
                </div>
                {conversation.lastMessage && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {conversation.lastMessage.text}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            {selectedConversation
              ? selectedConversation.participantHandle
              : recipientDid
              ? 'New Message'
              : 'Select a conversation'}
          </h2>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              {selectedConversation || recipientDid
                ? 'No messages yet'
                : 'Select a conversation to see messages'}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isCurrentUser = message.senderId === user?.did;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs sm:max-w-md px-4 py-2 rounded-lg ${
                        isCurrentUser
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white'
                      }`}
                    >
                      <p>Encrypted message</p>
                      <div className="text-xs mt-1 opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Message input */}
        {(selectedConversation || recipientDid) && (
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;