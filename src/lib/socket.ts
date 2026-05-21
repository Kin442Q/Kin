import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

/**
 * Socket.io подключение к бэкенду для realtime-чата.
 * URL берём из VITE_SOCKET_URL (или из VITE_API_URL без /api).
 */
function socketUrl(): string {
  const explicit = import.meta.env.VITE_SOCKET_URL as string | undefined
  if (explicit) return explicit
  const api = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
  return api.replace(/\/api\/?$/, '')
}

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket && socket.connected) return socket
  if (socket) {
    socket.connect()
    return socket
  }
  const token = useAuthStore.getState().token
  socket = io(socketUrl(), {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
  })
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
