import { CommunicationHandler, WebviewMessage, MessageCallback } from "./types"

export class RestHandler implements CommunicationHandler {
  private url: string
  private pollingInterval: number
  private pollingTimeoutId?: NodeJS.Timeout
  private messageCallback?: MessageCallback
  private isPolling: boolean

  constructor(url: string, pollingInterval: number) {
    this.url = url
    this.pollingInterval = pollingInterval
    this.isPolling = false
  }

  public async send(message: WebviewMessage): Promise<void> {
    try {
      const response = await fetch(`${this.url}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      console.error("メッセージ送信エラー:", error)
    }
  }

  public onMessage(callback: MessageCallback): void {
    this.messageCallback = callback
    if (!this.isPolling) {
      this.startPolling()
    }
  }

  private async pollMessages(): Promise<void> {
    if (!this.isPolling) return

    try {
      const response = await fetch(`${this.url}/messages`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const messages = await response.json()
      if (Array.isArray(messages) && this.messageCallback) {
        messages.forEach(message => this.messageCallback!(message))
      }
    } catch (error) {
      console.error("メッセージ取得エラー:", error)
    }

    // 継続的なポーリング
    if (this.isPolling) {
      this.pollingTimeoutId = setTimeout(
        () => this.pollMessages(),
        this.pollingInterval
      )
    }
  }

  private startPolling(): void {
    this.isPolling = true
    this.pollMessages()
  }

  public getState(): unknown | undefined {
    return undefined
  }

  public setState<T>(state: T): T {
    return state
  }

  public close(): void {
    this.isPolling = false
    if (this.pollingTimeoutId) {
      clearTimeout(this.pollingTimeoutId)
    }
  }
}