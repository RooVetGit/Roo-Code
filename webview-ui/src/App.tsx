import React from "react"
import "./App.css"
import { createCommunicationConfig } from "./services/api/types"
import { CommunicationFactory } from "./services/api/communication-factory"

function App() {
  React.useEffect(() => {
    // 環境に応じて適切な通信方式を設定
    try {
      const factory = CommunicationFactory.getInstance()
      if (typeof acquireVsCodeApi === "function") {
        factory.configure(createCommunicationConfig({ mode: "vscode" }))
      } else if (process.env.REACT_APP_COMMUNICATION_MODE === "rest") {
        factory.configure(
          createCommunicationConfig({
            mode: "rest",
            restUrl: process.env.REACT_APP_REST_API_URL || "http://localhost:3001",
            pollingInterval: parseInt(
              process.env.REACT_APP_POLLING_INTERVAL || "1000",
              10
            ),
          })
        )
      } else {
        factory.configure(
          createCommunicationConfig({
            mode: "websocket",
            wsUrl: process.env.REACT_APP_WEBSOCKET_URL || "ws://localhost:3001",
          })
        )
      }
    } catch (error) {
      console.error("Failed to configure communication:", error)
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Roo Cline Standalone</h1>
      </header>
      <main className="app-main">
        {/* TODO: Add your components here */}
      </main>
    </div>
  )
}

export default App
