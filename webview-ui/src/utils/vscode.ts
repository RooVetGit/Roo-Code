import { CommunicationFactory } from '../services/api/communication-factory'
import { CommunicationConfig, WebviewMessage } from '../services/api/types'

export function setupVsCodeComms(config: Partial<CommunicationConfig> = {}): void {
  const factory = CommunicationFactory.getInstance()

  const defaultConfig: CommunicationConfig = {
    mode: 'vscode',
    pollingInterval: 1000,
  }

  factory.configure({ ...defaultConfig, ...config })

  const handler = factory.getHandler()

  // エラーイベントのリッスン
  handler.onMessage((message: WebviewMessage) => {
    if (message.type === 'error') {
      console.error('Error from VS Code:', message.text)
    }
  })
}

export function isVsCodeEnvironment(): boolean {
  return typeof acquireVsCodeApi === 'function'
}

// VSCodeが利用可能な場合のみAPIを初期化
let vscodeApi: any = null
if (isVsCodeEnvironment()) {
  try {
    vscodeApi = acquireVsCodeApi()
  } catch (error) {
    console.warn('Failed to acquire VS Code API:', error)
  }
}

// VSCode APIのラッパー
export const vscode = {
  postMessage: (message: any) => {
    if (vscodeApi) {
      vscodeApi.postMessage(message)
    } else {
      console.log('Mock postMessage:', message)
    }
  },
  getState: () => {
    if (vscodeApi) {
      return vscodeApi.getState()
    }
    return null
  },
  setState: (state: any) => {
    if (vscodeApi) {
      vscodeApi.setState(state)
    }
  },
}
