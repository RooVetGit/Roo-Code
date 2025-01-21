import { WebviewMessage, MessageCallback, CommunicationHandler } from './types'

export class RestHandler implements CommunicationHandler {
  private _messageCallback: MessageCallback | null = null
  private _isPolling = false
  private _lastMessageId = 0

  constructor(
    private readonly _url: string,
    private readonly _pollingInterval: number = 1000
  ) {}

  async send(message: WebviewMessage): Promise<void> {
    try {
      const response = await fetch(this._url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  onMessage(callback: MessageCallback): void {
    this._messageCallback = callback
    if (!this._isPolling) {
      this._startPolling()
    }
  }

  private async _startPolling(): Promise<void> {
    this._isPolling = true
    while (this._isPolling) {
      try {
        const response = await fetch(`${this._url}?since=${this._lastMessageId}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const messages: WebviewMessage[] = await response.json()
        messages.forEach((message) => {
          if (this._messageCallback) {
            this._messageCallback(message)
          }
          if (message.id && typeof message.id === 'number') {
            this._lastMessageId = Math.max(this._lastMessageId, message.id)
          }
        })
      } catch (error) {
        console.error('Error polling messages:', error)
      }

      await new Promise((resolve) => setTimeout(resolve, this._pollingInterval))
    }
  }

  stopPolling(): void {
    this._isPolling = false
  }

  close(): void {
    this.stopPolling()
  }

  get url(): string {
    return this._url
  }

  get pollingInterval(): number {
    return this._pollingInterval
  }

  get isPolling(): boolean {
    return this._isPolling
  }
}