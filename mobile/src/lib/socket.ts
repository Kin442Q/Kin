import { io, type Socket } from 'socket.io-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SERVER_URL as SOCKET_URL } from './config'

let socket: Socket | null = null

/** Подключиться (или вернуть существующий) socket с актуальным токеном. */
export async function connectSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket
  const token = await AsyncStorage.getItem('kg_token')
  if (socket) {
    socket.auth = { token }
    socket.connect()
    return socket
  }
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
  })
  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
