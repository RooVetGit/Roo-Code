export interface WebviewMessage {
  type: string
  text?: string
  [key: string]: any
}