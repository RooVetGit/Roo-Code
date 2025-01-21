# Roo Cline スタンドアロンWebアプリケーション

このドキュメントでは、Roo ClineをVS Code拡張から独立したWebアプリケーションとして実行する方法について説明します。

## 目次

- [Roo Cline スタンドアロンWebアプリケーション](#roo-cline-スタンドアロンwebアプリケーション)
  - [目次](#目次)
  - [概要](#概要)
  - [動作要件](#動作要件)
  - [セットアップ手順](#セットアップ手順)
  - [開発環境の準備](#開発環境の準備)
  - [デプロイメント](#デプロイメント)
  - [通信方式の設定](#通信方式の設定)
    - [WebSocket](#websocket)
    - [REST API](#rest-api)
    - [VS Code拡張として実行](#vs-code拡張として実行)
  - [トラブルシューティング](#トラブルシューティング)
    - [よくある問題と解決方法](#よくある問題と解決方法)
    - [動作確認方法](#動作確認方法)

## 概要

Roo ClineのWebview UI部分は、VS Code拡張から独立して実行できるように設計されています。
以下の通信方式をサポートしています：

- WebSocket通信
- RESTful API通信
- VS Code Webview API (VS Code拡張として実行時)

## 動作要件

- Node.js 18.0.0以上
- pnpm 8.0.0以上
- モダンブラウザ（Chrome, Firefox, Safari, Edge）

## セットアップ手順

1. リポジトリのクローン：
```bash
git clone https://github.com/yourusername/Roo-Cline.git
cd Roo-Cline
```

2. 依存パッケージのインストール：
```bash
pnpm install
cd webview-ui
pnpm install
```

3. 環境変数の設定：
```bash
# .env.local ファイルを作成
COMMUNICATION_MODE=websocket  # または 'rest'
WEBSOCKET_URL=ws://localhost:3001  # WebSocket使用時
REST_API_URL=http://localhost:3001  # REST API使用時
POLLING_INTERVAL=1000  # REST APIのポーリング間隔（ミリ秒）
```

4. 開発サーバーの起動：
```bash
pnpm start
```

## 開発環境の準備

1. コンポーネントの開発

```typescript
// 通信ハンドラーの取得
import { CommunicationFactory } from "../services/api/communication-factory"
import { createCommunicationConfig } from "../services/api/types"

const factory = CommunicationFactory.getInstance()
factory.configure(
  createCommunicationConfig({
    mode: "websocket",  // または 'rest'
    wsUrl: "ws://localhost:3001"
  })
)

const handler = factory.getHandler()
```

2. メッセージの送受信

```typescript
// メッセージ送信
handler.send({
  type: "customMessage",
  text: "Hello, World!"
})

// メッセージ受信
handler.onMessage((message) => {
  console.log("Received:", message)
})
```

## デプロイメント

1. アプリケーションのビルド：
```bash
cd webview-ui
pnpm build
```

2. 静的ファイルのデプロイ：
`webview-ui/build` ディレクトリの内容をWebサーバーにデプロイします。

3. バックエンドサーバーの準備：
   - WebSocketサーバーまたはREST APIサーバーを用意
   - CORS設定の追加
   - 環境変数での接続先設定

## 通信方式の設定

### WebSocket

```typescript
factory.configure(createCommunicationConfig({
  mode: "websocket",
  wsUrl: "wss://your-server.com/ws"
}))
```

### REST API

```typescript
factory.configure(createCommunicationConfig({
  mode: "rest",
  restUrl: "https://your-server.com/api",
  pollingInterval: 1000
}))
```

### VS Code拡張として実行

```typescript
factory.configure(createCommunicationConfig({
  mode: "vscode"
}))
```

## トラブルシューティング

### よくある問題と解決方法

1. WebSocket接続エラー
   - WebSocketサーバーの起動確認
   - URLとポート番号の確認
   - ファイアウォール設定の確認

2. CORS エラー
   - バックエンドサーバーのCORS設定確認
   - 開発時は適切なプロキシ設定を追加

3. ビルドエラー
   - `node_modules`の再インストール
   - キャッシュのクリア
   - TypeScriptの型エラーの修正

### 動作確認方法

1. 開発サーバーの起動
```bash
cd webview-ui
pnpm start
```

2. コンソールログの確認
- ブラウザの開発者ツールでエラーの有無を確認
- WebSocket接続状態の確認
- APIリクエストの成功/失敗の確認

3. E2Eテストの実行
```bash
pnpm test:e2e
```

これらの手順で、Roo ClineをVS Code拡張から独立したWebアプリケーションとして実行できます。
問題が発生した場合は、まずこのドキュメントのトラブルシューティングセクションを参照してください。