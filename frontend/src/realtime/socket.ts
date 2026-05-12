import { io, type Socket } from 'socket.io-client'
import { API_URL } from '../config/apiUrl'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket && socket.connected) return socket
  const socketUrl = API_URL.replace(/\/api\/?$/, '')
  socket = io(socketUrl)
  return socket
}

