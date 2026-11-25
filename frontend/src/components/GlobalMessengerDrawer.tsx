import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  MessageSquare,
  Send,
  X,
  Search,
  CheckCheck,
  Check,
  User,
  Building,
  ChevronLeft,
  Loader2,
  Sparkles,
  UserCheck,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  Users
} from 'lucide-react';
import api from '../lib/api';
import socket from '../lib/socket';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

export interface MessengerUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  badge?: string | null;
  propertyTitle?: string;
  avatar?: string | null;
  phone?: string | null;
  relationshipStatus?: 'connected' | 'pending_sent' | 'pending_received' | 'none';
  friendRequestId?: string | null;
  lastMessage?: {
    text: string;
    createdAt: string;
    senderId: string;
    read: boolean;
  } | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  isOnline: boolean;
}

export interface FriendRequestItem {
  _id: string;
  senderId: {
    _id: string;
    name: string;
    email: string;
    role?: string;
    avatar?: string | null;
    phone?: string | null;
    tamilRole?: string;
    registrationPurpose?: string;
  };
  receiverId: string;
  propertyId?: {
    _id: string;
    title: string;
    location?: string;
    price?: number;
    images?: string[];
  } | null;
  propertyTitle?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  senderId: string | { _id: string; name?: string; email?: string; role?: string; avatar?: string };
  receiverId: string | { _id: string; name?: string; email?: string; role?: string; avatar?: string };
  propertyId?: {
    _id: string;
    title: string;
    location?: string;
    price?: number;
    rent?: number;
    images?: string[];
  } | null;
  text: string;
  read: boolean;
  createdAt: string;
}

interface GlobalMessengerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTargetUserId?: string | null;
  initialPropertyId?: string | null;
}

const QUICK_REPLIES = [
  'Hi!',
  'Is the property available?',
  'Agreement uploaded',
  'Rent paid'
];

export const GlobalMessengerDrawer: React.FC<GlobalMessengerDrawerProps> = ({
  isOpen,
  onClose,
  initialTargetUserId,
  initialPropertyId
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const currentUserId = (user as any)?._id || (user as any)?.id;

  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [contacts, setContacts] = useState<MessengerUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestItem[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<MessengerUser[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [requestingUserId, setRequestingUserId] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<MessengerUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(initialPropertyId || null);

  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of message thread
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch connected contacts
  const fetchContacts = async () => {
    if (!currentUserId) return;
    try {
      setLoadingContacts(true);
      const res = await api.get('/messages/contacts');
      const list = res.data?.contacts || res.data?.users || (Array.isArray(res.data) ? res.data : []);
      setContacts(list);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Fetch pending incoming friend requests
  const fetchPendingRequests = async () => {
    if (!currentUserId) return;
    try {
      setLoadingRequests(true);
      const res = await api.get('/messages/friend-requests');
      setPendingRequests(res.data || []);
    } catch (err) {
      console.error('Failed to load friend requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Search users for Discover
  const fetchDiscoverUsers = async (query = '') => {
    if (!currentUserId) return;
    try {
      setLoadingDiscover(true);
      const res = await api.get(`/messages/discover?search=${encodeURIComponent(query)}`);
      const list = res.data?.users || res.data?.contacts || (Array.isArray(res.data) ? res.data : []);
      setDiscoverUsers(list);
    } catch (err) {
      console.error('Failed to load discover users:', err);
    } finally {
      setLoadingDiscover(false);
    }
  };

  // Initial load when drawer opens
  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchContacts();
      fetchPendingRequests();
      if (activeTab === 'requests') {
        fetchDiscoverUsers(searchQuery);
      }
    }
  }, [isOpen, currentUserId, activeTab]);

  // Debounced discover search
  useEffect(() => {
    if (!isOpen || !currentUserId) return;
    if (activeTab === 'requests' || searchQuery.trim()) {
      const timer = setTimeout(() => {
        fetchDiscoverUsers(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, activeTab, isOpen, currentUserId]);

  // Handle initial target user selection when opened from a property or external button
  useEffect(() => {
    if (initialPropertyId) {
      setActivePropertyId(initialPropertyId);
    }
    if (initialTargetUserId && isOpen) {
      // Find in contacts first
      const foundInContacts = contacts.find((u) => u._id === initialTargetUserId);
      if (foundInContacts) {
        setSelectedUser(foundInContacts);
        setActiveTab('chats');
      } else {
        // Query user info
        api.get(`/messages/contacts`).then((res) => {
          const list: MessengerUser[] = res.data?.contacts || res.data?.users || (Array.isArray(res.data) ? res.data : []);
          const found = list.find((u) => u._id === initialTargetUserId);
          if (found) {
            setSelectedUser(found);
            setActiveTab('chats');
            setContacts((prev) => {
              if (prev.some((p) => p._id === found._id)) return prev;
              return [found, ...prev];
            });
          } else {
            api.get(`/messages/discover?search=`).then((dRes) => {
              const dList: MessengerUser[] = dRes.data?.users || dRes.data?.contacts || (Array.isArray(dRes.data) ? dRes.data : []);
              const dFound = dList.find((u) => u._id === initialTargetUserId);
              if (dFound) {
                setSelectedUser(dFound);
                setActiveTab('chats');
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  }, [initialTargetUserId, initialPropertyId, isOpen, contacts.length]);

  // Fetch thread messages when selectedUser changes
  useEffect(() => {
    if (!selectedUser || !currentUserId || !isOpen) return;

    let isSubscribed = true;
    setLoadingMessages(true);

    api
      .get(`/messages/thread/${selectedUser._id}`)
      .then((res) => {
        if (!isSubscribed) return;
        setMessages(res.data || []);
        setLoadingMessages(false);
        setTimeout(() => scrollToBottom('auto'), 100);

        // Update unread count locally for this user
        setContacts((prev) =>
          prev.map((u) => (u._id === selectedUser._id ? { ...u, unreadCount: 0 } : u))
        );

        // Notify global badge
        window.dispatchEvent(new Event('reside:messages-updated'));
      })
      .catch((err) => {
        console.error('Failed to load thread:', err);
        if (isSubscribed) {
          setLoadingMessages(false);
          if (err.response?.status === 403) {
            toast.info(t('Connection needed: Send a friend request to chat with this user.', 'இந்த பயனருடன் பேச நண்பர் கோரிக்கை அனுப்பவும்.'));
          }
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedUser?._id, isOpen, currentUserId]);

  // Socket.IO real-time event listeners
  useEffect(() => {
    if (!currentUserId || !isOpen) return;

    // Register user with socket if not already registered
    socket.emit('register_user', currentUserId);

    // 1. Receive incoming real-time message
    const handleReceiveMessage = (newMsg: ChatMessage) => {
      const senderIdStr =
        typeof newMsg.senderId === 'object' ? newMsg.senderId?._id : newMsg.senderId;
      const receiverIdStr =
        typeof newMsg.receiverId === 'object' ? newMsg.receiverId?._id : newMsg.receiverId;

      const isCurrentThread =
        selectedUser &&
        (senderIdStr === selectedUser._id || receiverIdStr === selectedUser._id);

      if (isCurrentThread) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom('smooth'), 100);

        if (senderIdStr === selectedUser._id) {
          api.get(`/messages/thread/${selectedUser._id}`).catch(() => {});
        }
      }

      // Update contacts list's lastMessage and unreadCount
      setContacts((prev) => {
        const otherId = senderIdStr === currentUserId ? receiverIdStr : senderIdStr;
        let found = false;
        const updated = prev.map((u) => {
          if (u._id === otherId) {
            found = true;
            return {
              ...u,
              lastMessage: {
                text: newMsg.text,
                createdAt: newMsg.createdAt,
                senderId: senderIdStr,
                read: isCurrentThread || senderIdStr === currentUserId
              },
              unreadCount:
                !isCurrentThread && senderIdStr !== currentUserId
                  ? u.unreadCount + 1
                  : u.unreadCount
            };
          }
          return u;
        });

        if (!found) {
          fetchContacts();
          return prev;
        }

        updated.sort((a, b) => {
          const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        return updated;
      });

      window.dispatchEvent(new Event('reside:messages-updated'));
    };

    // 2. Messages read receipt
    const handleMessagesRead = (data: { readerId: string; threadWith: string }) => {
      if (selectedUser && data.readerId === selectedUser._id) {
        setMessages((prev) =>
          prev.map((m) => {
            const senderIdStr =
              typeof m.senderId === 'object' ? m.senderId?._id : m.senderId;
            if (senderIdStr === currentUserId) {
              return { ...m, read: true };
            }
            return m;
          })
        );
      }
    };

    // 3. Online users updated
    const handleOnlineUsersUpdated = (onlineUserIds: string[]) => {
      const set = new Set(onlineUserIds.map(String));
      setContacts((prev) =>
        prev.map((u) => ({
          ...u,
          isOnline: set.has(String(u._id))
        }))
      );
      setDiscoverUsers((prev) =>
        prev.map((u) => ({
          ...u,
          isOnline: set.has(String(u._id))
        }))
      );
      if (selectedUser) {
        setSelectedUser((prev) =>
          prev ? { ...prev, isOnline: set.has(String(prev._id)) } : null
        );
      }
    };

    // 4. Friend request received live
    const handleFriendRequestReceived = (request: FriendRequestItem) => {
      setPendingRequests((prev) => {
        if (prev.some((r) => r._id === request._id)) return prev;
        return [request, ...prev];
      });
      toast.info(
        t(
          `New friend request from ${request.senderId?.name || 'a user'}!`,
          `${request.senderId?.name || 'ஒரு பயனரிடமிருந்து'} புதிய நண்பர் கோரிக்கை வந்துள்ளது!`
        )
      );
      window.dispatchEvent(new Event('reside:messages-updated'));
    };

    // 5. Friend request updated live
    const handleFriendRequestUpdated = (data: any) => {
      fetchPendingRequests();
      fetchContacts();
      if (data.status === 'accepted') {
        toast.success(t('Friend request accepted! You can now chat.', 'நண்பர் கோரிக்கை ஏற்கப்பட்டது! நீங்கள் இப்போது அரட்டையடிக்கலாம்.'));
      }
      window.dispatchEvent(new Event('reside:messages-updated'));
    };

    // 6. Typing indicators
    const handleTyping = (data: { senderId: string; receiverId: string }) => {
      if (selectedUser && data.senderId === selectedUser._id) {
        setIsOtherTyping(true);
      }
    };

    const handleStopTyping = (data: { senderId: string; receiverId: string }) => {
      if (selectedUser && data.senderId === selectedUser._id) {
        setIsOtherTyping(false);
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('online_users_updated', handleOnlineUsersUpdated);
    socket.on('friend_request_received', handleFriendRequestReceived);
    socket.on('friend_request_updated', handleFriendRequestUpdated);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('online_users_updated', handleOnlineUsersUpdated);
      socket.off('friend_request_received', handleFriendRequestReceived);
      socket.off('friend_request_updated', handleFriendRequestUpdated);
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);
    };
  }, [currentUserId, selectedUser?._id, isOpen]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!selectedUser || !currentUserId) return;

    socket.emit('typing', { senderId: currentUserId, receiverId: selectedUser._id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { senderId: currentUserId, receiverId: selectedUser._id });
    }, 1200);
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? inputText).trim();
    if (!content || !selectedUser || !currentUserId || sending) return;

    try {
      setSending(true);
      socket.emit('stop_typing', { senderId: currentUserId, receiverId: selectedUser._id });

      const payload: any = {
        receiverId: selectedUser._id,
        text: content
      };
      if (activePropertyId) {
        payload.propertyId = activePropertyId;
      }

      const res = await api.post('/messages/send', payload);
      const newMsg = res.data;

      setMessages((prev) => {
        if (prev.some((m) => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });

      setInputText('');
      setTimeout(() => scrollToBottom('smooth'), 100);
      inputRef.current?.focus();
    } catch (err: any) {
      console.error('Error sending message:', err);
      if (err.response?.status === 403) {
        toast.error(t('Cannot send message: You must be connected or accept a friend request first.', 'செய்தி அனுப்ப முடியவில்லை: முதலில் நண்பர் கோரிக்கையை ஏற்க வேண்டும்.'));
      } else {
        toast.error(t('Failed to send message', 'செய்தி அனுப்ப முடியவில்லை'));
      }
    } finally {
      setSending(false);
    }
  };

  // Quick reply pill click
  const handleQuickReply = (pill: string) => {
    setInputText(pill);
    handleSendMessage(pill);
  };

  // Respond to incoming friend request
  const handleRespondRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      setRespondingRequestId(requestId);
      const res = await api.post(`/messages/friend-request/${requestId}/respond`, { action });
      toast.success(
        action === 'accept'
          ? t('Friend request accepted! Starting chat...', 'நண்பர் கோரிக்கை ஏற்கப்பட்டது! அரட்டை தொடங்குகிறது...')
          : t('Friend request declined.', 'நண்பர் கோரிக்கை நிராகரிக்கப்பட்டது.')
      );

      // Remove from pending list
      setPendingRequests((prev) => prev.filter((r) => r._id !== requestId));
      // Refresh contacts
      fetchContacts();

      if (action === 'accept' && res.data?.request?.senderId) {
        // Automatically switch to chats tab and open thread
        const senderObj = res.data.request.senderId;
        const senderIdStr = typeof senderObj === 'object' ? senderObj._id : senderObj;
        setActiveTab('chats');
        if (senderIdStr) {
          const matched = contacts.find((c) => c._id === senderIdStr);
          if (matched) {
            setSelectedUser(matched);
          } else {
            api.get('/messages/contacts').then((resp) => {
              const list: MessengerUser[] = resp.data?.contacts || (Array.isArray(resp.data) ? resp.data : []);
              const u = list.find((item) => item._id === senderIdStr);
              if (u) setSelectedUser(u);
            });
          }
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.msg || t('Failed to respond to request', 'கோரிக்கைக்கு பதிலளிக்க முடியவில்லை'));
    } finally {
      setRespondingRequestId(null);
    }
  };

  // Send friend request from Discover list
  const handleSendFriendRequest = async (targetUser: MessengerUser) => {
    try {
      setRequestingUserId(targetUser._id);
      const res = await api.post('/messages/friend-request', {
        receiverId: targetUser._id
      });

      if (res.data?.connected || res.data?.status === 'already_connected' || res.data?.status === 'connected') {
        toast.success(t(`Already connected with ${targetUser.name}!`, `${targetUser.name} உடன் ஏற்கனவே இணைக்கப்பட்டுள்ளது!`));
        setSelectedUser(targetUser);
        setActiveTab('chats');
      } else if (res.data?.status === 'accepted') {
        toast.success(t(`Connected with ${targetUser.name}! Opening chat...`, `${targetUser.name} உடன் இணைக்கப்பட்டது!`));
        setSelectedUser(targetUser);
        setActiveTab('chats');
        fetchContacts();
      } else {
        toast.success(t(`Friend & chat request sent to ${targetUser.name}`, `${targetUser.name} க்கு நண்பர் கோரிக்கை அனுப்பப்பட்டது`));
        // Update user's relationship status locally
        setDiscoverUsers((prev) =>
          prev.map((u) => (u._id === targetUser._id ? { ...u, relationshipStatus: 'pending_sent' } : u))
        );
      }
    } catch (err: any) {
      toast.error(err.response?.data?.msg || t('Failed to send friend request', 'நண்பர் கோரிக்கை அனுப்ப முடியவில்லை'));
    } finally {
      setRequestingUserId(null);
    }
  };

  // Generate color avatar initials
  const getAvatarGradient = (name = '') => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-purple-500 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-cyan-500 to-blue-600',
      'from-rose-500 to-red-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  const getInitials = (name = '') => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return t('Just now', 'இப்போது');
      if (diffMin < 60) return `${diffMin}m`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Filtered contacts based on search query in Chats tab
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  if (!isOpen || !currentUserId) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99990] flex items-center justify-end bg-black/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Messenger Panel */}
      <div className="relative z-10 flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl dark:bg-slate-900 md:h-[92vh] md:my-auto md:mr-6 md:rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Top Floating App Bar */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/30">
              <MessageSquare className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('ReSide Messenger', 'ரீசைட் மெசஞ்சர்')}
                </h3>
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t('Live', 'நேரலை')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('Chat with connected property owners, tenants & friends', 'சொத்து உரிமையாளர்கள், குத்தகைதாரர்கள் மற்றும் நண்பர்களுடன் உரையாடுங்கள்')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={t('Close', 'மூடு')}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* 2-Column Split: Left Sidebar + Right Chat Pane */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* LEFT SIDEBAR (1/3) — Sub-tabs: Chats vs Requests & Discover */}
          <div
            className={`w-full flex-col border-r border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 md:flex md:w-1/3 ${
              selectedUser ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Tabs Header */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('chats')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'chats'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{t('Chats', 'அரட்டைகள்')}</span>
                {contacts.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                    {contacts.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'requests'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>{t('Requests', 'கோரிக்கைகள்')}</span>
                {pendingRequests.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white animate-pulse">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-2.5 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'chats'
                      ? t('Filter active chats...', 'அரட்டைகளைத் தேடுங்கள்...')
                      : t('Search users to connect...', 'இணைக்க பயனர்களைத் தேடுங்கள்...')
                  }
                  className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'chats' ? (
                /* TAB 1: CONNECTED CHATS */
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loadingContacts ? (
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      <span className="text-xs">{t('Loading conversations...', 'உரையாடல்கள் ஏற்றப்படுகின்றன...')}</span>
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                      <p>{t('No active chats yet.', 'செயலில் உள்ள அரட்டைகள் எதுவும் இல்லை.')}</p>
                      <p className="text-[11px] text-slate-400">
                        {t(
                          'Owners and tenants of properties are connected automatically. Switch to "Requests" to find registered users or view pending requests.',
                          'உரிமையாளர்கள் மற்றும் குத்தகைதாரர்கள் தானாக இணைக்கப்பட்டுள்ளனர். பயனர்களைத் தேட "கோரிக்கைகள்" தாவலுக்கு மாறவும்.'
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('requests')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition cursor-pointer mt-2"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>{t('Discover Users & Requests', 'பயனர்களைக் கண்டறியுங்கள்')}</span>
                      </button>
                    </div>
                  ) : (
                    filteredContacts.map((u) => {
                      const isSelected = selectedUser?._id === u._id;
                      const hasUnread = u.unreadCount > 0;

                      return (
                        <div
                          key={u._id}
                          onClick={() => setSelectedUser(u)}
                          className={`flex items-center gap-3 p-3 transition-colors cursor-pointer select-none ${
                            isSelected
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-blue-600 dark:border-blue-400'
                              : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          {/* Avatar with Online indicator */}
                          <div className="relative shrink-0">
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="h-10 w-10 rounded-full object-cover shadow-2xs"
                              />
                            ) : (
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr ${getAvatarGradient(
                                  u.name
                                )} text-xs font-bold text-white shadow-xs`}
                              >
                                {getInitials(u.name)}
                              </div>
                            )}
                            {u.isOnline ? (
                              <span
                                className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900 shadow-2xs"
                                title={t('Online', 'ஆன்லைன்')}
                              />
                            ) : (
                              <span
                                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-300 dark:border-slate-900 dark:bg-slate-600"
                                title={t('Offline', 'ஆஃப்லைன்')}
                              />
                            )}
                          </div>

                          {/* Contact Info & Preview */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h4
                                className={`text-xs font-semibold truncate ${
                                  hasUnread
                                    ? 'text-slate-950 dark:text-white font-bold'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {u.name}
                              </h4>
                              {u.lastMessage?.createdAt && (
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {formatRelativeTime(u.lastMessage.createdAt)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className={`inline-block rounded-md px-1.5 py-0.2 text-[9px] font-medium ${
                                u.badge === 'Property Owner'
                                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold'
                                  : u.badge === 'Tenant'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold'
                                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}>
                                {u.badge || u.role}
                              </span>
                              {u.propertyTitle && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={u.propertyTitle}>
                                  • {u.propertyTitle}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-1 mt-1">
                              <p
                                className={`text-[11px] truncate ${
                                  hasUnread
                                    ? 'font-semibold text-slate-900 dark:text-white'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {u.lastMessage?.text || t('Tap to start chatting', 'உரையாடலைத் தொடங்கவும்')}
                              </p>

                              {hasUnread && (
                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs shrink-0">
                                  {u.unreadCount > 9 ? '9+' : u.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* TAB 2: REQUESTS & DISCOVER */
                <div className="p-3 space-y-4">
                  {/* Section A: Incoming Pending Requests */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('Incoming Friend Requests', 'உள்வரும் நண்பர் கோரிக்கைகள்')} ({pendingRequests.length})
                      </span>
                    </div>

                    {loadingRequests ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      </div>
                    ) : pendingRequests.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">
                        {t('No pending friend requests', 'நிலுவையில் உள்ள கோரிக்கைகள் எதுவும் இல்லை')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {pendingRequests.map((req) => (
                          <div
                            key={req._id}
                            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 shadow-xs space-y-2.5"
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${getAvatarGradient(
                                  req.senderId?.name
                                )} text-xs font-bold text-white`}
                              >
                                {getInitials(req.senderId?.name || 'User')}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {req.senderId?.name || t('User', 'பயனர்')}
                                </h5>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {req.senderId?.email} • {req.senderId?.role || 'Customer'}
                                </p>
                                {req.propertyTitle && (
                                  <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">
                                    <Building className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{req.propertyTitle}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                              <button
                                type="button"
                                disabled={respondingRequestId === req._id}
                                onClick={() => handleRespondRequest(req._id, 'accept')}
                                className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition"
                              >
                                {respondingRequestId === req._id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                <span>{t('Accept', 'ஏற்கவும்')}</span>
                              </button>

                              <button
                                type="button"
                                disabled={respondingRequestId === req._id}
                                onClick={() => handleRespondRequest(req._id, 'reject')}
                                className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 py-1.5 px-3 text-xs font-medium disabled:opacity-50 cursor-pointer transition"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>{t('Decline', 'நிராகரி')}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section B: Discover & Add Friends */}
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                      {t('Discover & Connect', 'கண்டறிந்து இணைக்க')}
                    </span>

                    {loadingDiscover ? (
                      <div className="flex items-center justify-center p-6">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      </div>
                    ) : discoverUsers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        {t('No registered users found matching query', 'பயனர்கள் எவரும் காணப்படவில்லை')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {discoverUsers.map((u) => {
                          const isConnected = (u as any).relation === 'connected' || u.relationshipStatus === 'connected';
                          const isPendingSent = (u as any).relation === 'pending_sent' || u.relationshipStatus === 'pending_sent';
                          const isPendingReceived = (u as any).relation === 'pending_received' || u.relationshipStatus === 'pending_received';

                          return (
                            <div
                              key={u._id}
                              className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-2.5 shadow-2xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${getAvatarGradient(
                                    u.name
                                  )} text-[11px] font-bold text-white`}
                                >
                                  {getInitials(u.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <h5 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                      {u.name}
                                    </h5>
                                    {u.isOnline && (
                                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 truncate">
                                    {u.role}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isConnected ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setActiveTab('chats');
                                    }}
                                    className="flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 py-1 px-2.5 text-[11px] font-semibold cursor-pointer transition"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    <span>{t('Chat', 'அரட்டை')}</span>
                                  </button>
                                ) : isPendingSent ? (
                                  <span className="flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 py-1 px-2 text-[10px] font-medium">
                                    <Clock className="h-3 w-3" />
                                    <span>{t('Pending', 'நிலுவை')}</span>
                                  </span>
                                ) : isPendingReceived ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (u.friendRequestId) {
                                        handleRespondRequest(u.friendRequestId, 'accept');
                                      }
                                    }}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 py-1 px-2.5 text-[11px] font-semibold cursor-pointer transition"
                                  >
                                    <Check className="h-3 w-3" />
                                    <span>{t('Accept', 'ஏற்கவும்')}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={requestingUserId === u._id}
                                    onClick={() => handleSendFriendRequest(u)}
                                    className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-1 px-2.5 text-[11px] font-semibold shadow-2xs disabled:opacity-50 cursor-pointer transition"
                                  >
                                    {requestingUserId === u._id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <UserPlus className="h-3 w-3" />
                                    )}
                                    <span>{t('Connect', 'இணைக்கவும்')}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT CHAT PANE (2/3) — Real-Time Conversation */}
          <div
            className={`flex-1 flex-col bg-white dark:bg-slate-900 ${
              selectedUser ? 'flex' : 'hidden md:flex'
            }`}
          >
            {selectedUser ? (
              <>
                {/* Royal Blue Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-[#1e3a8a] to-[#1d4ed8] px-4 py-2.5 text-white shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Back button for mobile */}
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="md:hidden mr-1 text-white/80 hover:text-white cursor-pointer"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="relative shrink-0">
                      {selectedUser.avatar ? (
                        <img
                          src={selectedUser.avatar}
                          alt={selectedUser.name}
                          className="h-9 w-9 rounded-full object-cover border border-white/30"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white border border-white/30">
                          {getInitials(selectedUser.name)}
                        </div>
                      )}
                      {selectedUser.isOnline && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#1e3a8a] bg-emerald-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold truncate leading-tight">
                          {selectedUser.name}
                        </h4>
                        <span className="rounded bg-white/20 px-1.5 py-0.2 text-[10px] font-medium text-white/90">
                          {selectedUser.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/80 leading-tight">
                        {isOtherTyping ? (
                          <span className="italic font-medium text-emerald-300 animate-pulse">
                            {t('typing...', 'தட்டச்சு செய்கிறார்...')}
                          </span>
                        ) : selectedUser.isOnline ? (
                          <span className="text-emerald-300 font-medium">● {t('Online', 'ஆன்லைன்')}</span>
                        ) : (
                          <span className="text-white/60">{t('Offline', 'ஆஃப்லைன்')}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activePropertyId && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white">
                        <Building className="h-3 w-3" />
                        {t('Property Linked', 'சொத்து இணைக்கப்பட்டுள்ளது')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Auto-scrolling Message Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/30">
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-xs">{t('Loading conversation...', 'உரையாடல் ஏற்றப்படுகிறது...')}</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
                      <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                        <MessageSquare className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {t('Start a conversation with', 'உரையாடலைத் தொடங்கவும்')} {selectedUser.name}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        {t('Say hello or choose one of the quick replies below.', 'வணக்கம் சொல்லுங்கள் அல்லது கீழே உள்ள குறிப்புகளைத் தேர்ந்தெடுக்கவும்.')}
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const senderIdStr =
                        typeof m.senderId === 'object' ? m.senderId?._id : m.senderId;
                      const isMe = senderIdStr === currentUserId;

                      return (
                        <div
                          key={m._id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`relative px-3.5 py-2 text-xs leading-relaxed max-w-[82%] sm:max-w-[70%] shadow-2xs ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-2xl rounded-br-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-xs border border-slate-200/70 dark:border-slate-700'
                            }`}
                          >
                            {/* Property Mini-Card if message contains propertyId */}
                            {m.propertyId && (
                              <div
                                className={`mb-2 rounded-xl p-2 border flex items-center gap-2.5 ${
                                  isMe
                                    ? 'bg-blue-700/60 border-blue-400/40 text-white'
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {m.propertyId.images?.[0] ? (
                                  <img
                                    src={m.propertyId.images[0]}
                                    alt={m.propertyId.title}
                                    className="h-10 w-10 rounded-lg object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                                    <Building className="h-5 w-5 text-blue-500" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <h5 className="font-semibold text-[11px] truncate leading-tight">
                                    {m.propertyId.title}
                                  </h5>
                                  <p className="text-[10px] opacity-80 leading-tight">
                                    {m.propertyId.rent
                                      ? `₹${Number(m.propertyId.rent).toLocaleString()}/mo`
                                      : m.propertyId.price
                                      ? `₹${Number(m.propertyId.price).toLocaleString()}`
                                      : m.propertyId.location || ''}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Message text */}
                            <p className="whitespace-pre-wrap break-words">{m.text}</p>

                            {/* Timestamp & Read ticks */}
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                isMe ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              <span>{formatMessageTime(m.createdAt)}</span>
                              {isMe && (
                                <span title={m.read ? t('Read', 'படிக்கப்பட்டது') : t('Sent', 'அனுப்பப்பட்டது')}>
                                  {m.read ? (
                                    <CheckCheck className="h-3 w-3 text-sky-200" />
                                  ) : (
                                    <Check className="h-3 w-3 opacity-70" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Other user is typing indicator */}
                  {isOtherTyping && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-2xl rounded-bl-xs w-fit shadow-2xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Bar: Quick Replies & Input Bar */}
                <div className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 space-y-2">
                  {/* Quick-reply pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    <span className="text-[10px] font-medium text-slate-400 shrink-0 flex items-center gap-1 mr-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      {t('Quick:', 'விரைவு:')}
                    </span>
                    {QUICK_REPLIES.map((pill) => (
                      <button
                        key={pill}
                        type="button"
                        onClick={() => handleQuickReply(pill)}
                        className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-300 transition-all shrink-0 cursor-pointer"
                      >
                        {pill}
                      </button>
                    ))}
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={handleInputChange}
                      placeholder={t('Type a message... (Press Enter to send)', 'செய்தியைத் தட்டச்சு செய்க...')}
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />

                    <button
                      type="submit"
                      disabled={!inputText.trim() || sending}
                      className="flex h-8.5 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                      {sending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>{t('Send', 'அனுப்பு')}</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* No Selected User Empty State */
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                <div className="h-16 w-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-xs">
                  <MessageSquare className="h-8 w-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t('Welcome to ReSide Messenger', 'ரீசைட் மெசஞ்சருக்கு வரவேற்கிறோம்')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed">
                  {t(
                    'Select a contact from Chats or go to Requests to discover registered users and accept invitations.',
                    'அரட்டைகளிலிருந்து தொடர்பைத் தேர்ந்தெடுக்கவும் அல்லது புதிய பயனர்களைக் கண்டறிய கோரிக்கைகளுக்குச் செல்லவும்.'
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GlobalMessengerDrawer;
