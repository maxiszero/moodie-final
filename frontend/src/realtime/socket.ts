import { io, type Socket } from 'socket.io-client'
import { API_URL } from '../config/apiUrl'

let socket: Socket | null = null

function socketBaseUrl(): string {
  const trimmed = API_URL.replace(/\/$/, '')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return trimmed.replace(/\/api\/?$/, '')
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}

export function getSocket(): Socket {
  if (socket && socket.connected) return socket
  socket = io(socketBaseUrl(), { transports: ['websocket', 'polling'] })
  return socket
}

