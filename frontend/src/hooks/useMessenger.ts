import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import socket from '../lib/socket';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export function useMessenger() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const currentUserId = (user as any)?._id || (user as any)?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetPropertyId, setTargetPropertyId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.get('/messages/unread-count');
      setUnreadCount(res.data?.unreadCount || 0);
    } catch {
      // ignore
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [currentUserId, fetchUnreadCount]);

  useEffect(() => {
    if (!currentUserId) return;

    const handleReceive = (msg: any) => {
      const receiverIdStr =
        typeof msg.receiverId === 'object' ? msg.receiverId?._id : msg.receiverId;
      if (receiverIdStr === currentUserId) {
        fetchUnreadCount();
      }
    };

    const handleUpdated = () => {
      fetchUnreadCount();
    };

    const handleFriendRequest = (data: any) => {
      console.log('[useMessenger] Real-time friend_request_received:', data);
      fetchUnreadCount();

      const senderObj = data?.sender || data?.request?.senderId || data?.senderId;
      const senderName =
        (typeof senderObj === 'object' ? senderObj?.name || senderObj?.fullName || senderObj?.username : null) ||
        (typeof data?.sender === 'string' ? data.sender : null) ||
        'Someone';

      toast.info(
        t(
          `${senderName} sent you a friend request`,
          `${senderName} உங்களுக்கு நண்பர் கோரிக்கை அனுப்பியுள்ளார்`
        ),
        {
          duration: 5000,
          action: {
            label: t('View', 'பார்'),
            onClick: () => {
              openMessenger();
            }
          }
        }
      );

      try {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch (e) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reside:friend-request-received', { detail: data }));
        window.dispatchEvent(new Event('reside:messages-updated'));
      }
    };

    const handleFriendRequestUpdated = (data: any) => {
      fetchUnreadCount();
      try {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch (e) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reside:friend-request-updated', { detail: data }));
        window.dispatchEvent(new Event('reside:messages-updated'));
      }
    };

    const handleOpen = (e: any) => {
      const tUid = e.detail?.userId || e.detail?.targetUserId || null;
      const propertyId = e.detail?.propertyId || null;
      setTargetUserId(tUid || null);
      setTargetPropertyId(propertyId || null);
      setIsOpen(true);
    };

    const handleClose = () => {
      setIsOpen(false);
      setTargetUserId(null);
      setTargetPropertyId(null);
      fetchUnreadCount();
    };

    socket.on('receive_message', handleReceive);
    socket.on('messages_read', handleUpdated);
    socket.on('friend_request_received', handleFriendRequest);
    socket.on('friend_request_updated', handleFriendRequestUpdated);
    window.addEventListener('reside:messages-updated', handleUpdated);
    window.addEventListener('reside:open-messenger', handleOpen);
    window.addEventListener('open-reside-messenger', handleOpen);
    window.addEventListener('reside:close-messenger', handleClose);

    return () => {
      socket.off('receive_message', handleReceive);
      socket.off('messages_read', handleUpdated);
      socket.off('friend_request_received', handleFriendRequest);
      socket.off('friend_request_updated', handleFriendRequestUpdated);
      window.removeEventListener('reside:messages-updated', handleUpdated);
      window.removeEventListener('reside:open-messenger', handleOpen);
      window.removeEventListener('open-reside-messenger', handleOpen);
      window.removeEventListener('reside:close-messenger', handleClose);
    };
  }, [currentUserId, fetchUnreadCount]);

  const openMessenger = (tUid?: string | null, propId?: string | null) => {
    setTargetUserId(tUid || null);
    setTargetPropertyId(propId || null);
    setIsOpen(true);
    dispatchOpenMessenger(tUid, propId);
  };

  const closeMessenger = () => {
    setIsOpen(false);
    setTargetUserId(null);
    setTargetPropertyId(null);
    fetchUnreadCount();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reside:close-messenger'));
    }
  };

  return {
    isOpen,
    unreadCount,
    targetUserId,
    targetPropertyId,
    openMessenger,
    closeMessenger,
    fetchUnreadCount
  };
}

export const dispatchOpenMessenger = (targetUserId?: string | null, propertyId?: string | null) => {
  if (typeof window !== 'undefined') {
    const detail = {
      targetUserId: targetUserId || null,
      userId: targetUserId || null,
      propertyId: propertyId || null
    };
    window.dispatchEvent(new CustomEvent('reside:open-messenger', { detail }));
    window.dispatchEvent(new CustomEvent('open-reside-messenger', { detail }));
  }
};
