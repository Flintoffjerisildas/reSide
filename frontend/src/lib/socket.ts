import { io } from 'socket.io-client';

const socketUrl =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : '';

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
          socket.emit('register_user', uid);
        }
      }
    } catch (e) {}
  };

  socket.on('connect', tryRegister);
  if (socket.connected) {
    tryRegister();
  }
}

export default socket;
