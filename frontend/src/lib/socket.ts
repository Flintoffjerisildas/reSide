import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined;

export const socket = io(socketUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  auth: (cb) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    cb({ token });
  }
});

if (typeof window !== 'undefined') {
  const tryRegister = () => {
    try {
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        const uid = u._id || u.id;
        if (uid) {
          const uidStr = String(uid);
          socket.emit('register_user', uidStr);
          socket.emit('join', uidStr);
          socket.emit('join', `user_${uidStr}`);
        }
      }
    } catch (e) {}
  };

  socket.on('connect', tryRegister);
  socket.on('reconnect', tryRegister);
  window.addEventListener('reside:user-logged-in', tryRegister);
  if (socket.connected) {
    tryRegister();
  }
}

export default socket;
