interface Window {
  acquireVsCodeApi: () => {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
  isVsCodeEnv?: boolean;
}

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

declare module '@vscode/webview-ui-toolkit/*' {
  const content: any;
  export default content;
}

declare module '@vscode/webview-ui-toolkit' {
  export const provideVSCodeDesignSystem: any;
  export const vsCodeButton: any;
  export const vsCodeTextField: any;
  // 他のコンポーネントも必要に応じて追加
}