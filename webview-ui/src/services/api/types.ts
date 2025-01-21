export interface WebviewMessage {
  type: string;
  text?: string;
  [key: string]: any;
}

export type MessageCallback = (message: WebviewMessage) => void;

export interface CommunicationHandler {
  send(message: WebviewMessage): Promise<void>;
  onMessage(callback: MessageCallback): void;
}

export interface VSCodeHandler extends CommunicationHandler {
  getState(): any;
  setState(state: any): void;
}

export type CommunicationMode = 'websocket' | 'rest' | 'vscode';

export interface CommunicationOptions {
  wsUrl?: string;
  restUrl?: string;
  pollingInterval?: number;
}

export interface CommunicationConfig {
  mode: CommunicationMode;
  wsUrl?: string;
  restUrl?: string;
  pollingInterval?: number;
}

export function createCommunicationConfig(config: {
  mode: CommunicationMode;
  wsUrl?: string;
  restUrl?: string;
  pollingInterval?: number;
}): CommunicationConfig {
  return {
    mode: config.mode,
    wsUrl: config.wsUrl,
    restUrl: config.restUrl,
    pollingInterval: config.pollingInterval || 1000,
  };
}

export class VSCodeAPI implements VSCodeHandler {
  private readonly _vscode: any;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this._vscode = acquireVsCodeApi();
    } else {
      this._vscode = {
        postMessage: (message: any) => {
          console.log('Mock message:', message);
        },
        getState: () => null,
        setState: () => {},
      };
    }
  }

  async send(message: WebviewMessage): Promise<void> {
    this._vscode.postMessage(message);
  }

  onMessage(callback: MessageCallback): void {
    window.addEventListener('message', (event) => {
      callback(event.data);
    });
  }

  getState(): any {
    return this._vscode.getState();
  }

  setState(state: any): void {
    this._vscode.setState(state);
  }
}