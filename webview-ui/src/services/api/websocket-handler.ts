import { WebviewMessage, MessageCallback, CommunicationHandler } from './types'

export class WebSocketHandler implements CommunicationHandler {
  private _ws: WebSocket | null = null
  private _reconnectAttempts = 0
  private readonly _maxReconnectAttempts = 5
  private readonly _reconnectDelay = 1000
  private _messageCallback: MessageCallback | null = null

  constructor(private readonly _url: string) {
    this._connect()
  }

  private _connect(): void {
    try {
      this._ws = new WebSocket(this._url)

      this._ws.onopen = () => {
        console.log('WebSocket connected')
        this._reconnectAttempts = 0
      }

      this._ws.onclose = () => {
        console.log('WebSocket disconnected')
        this._tryReconnect()
      }

      this._ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      this._ws.onmessage = (event) => {
        if (this._messageCallback) {
          try {
            const message = JSON.parse(event.data)
            this._messageCallback(message)
          } catch (error) {
            console.error('Error parsing message:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error connecting to WebSocket:', error)
      this._tryReconnect()
    }
  }

  private _tryReconnect(): void {
    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      this._reconnectAttempts++
      console.log(
        `Attempting to reconnect (${this._reconnectAttempts}/${this._maxReconnectAttempts})`
      )
      setTimeout(() => this._connect(), this._reconnectDelay)
    }
  }

  async send(message: WebviewMessage): Promise<void> {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    return new Promise((resolve, reject) => {
      try {
        this._ws!.send(JSON.stringify(message))
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  onMessage(callback: MessageCallback): void {
    this._messageCallback = callback
  }

  close(): void {
    if (this._ws) {
      this._ws.close()
    }
  }
}