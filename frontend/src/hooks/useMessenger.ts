import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import socket from '../lib/socket';
import { useAuth } from '../contexts/AuthContext';

export function useMessenger() {
  const { user } = useAuth();
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
    window.addEventListener('reside:messages-updated', handleUpdated);
    window.addEventListener('reside:open-messenger', handleOpen);
    window.addEventListener('open-reside-messenger', handleOpen);
    window.addEventListener('reside:close-messenger', handleClose);

    return () => {
      socket.off('receive_message', handleReceive);
      socket.off('messages_read', handleUpdated);
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
