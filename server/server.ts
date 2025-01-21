import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import cors from 'cors'
import { WebviewMessage } from './src/types'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })
const port = process.env.PORT || 3001

// REST APIの設定
app.use(cors())
app.use(express.json())

// メッセージ保存用の配列
const messages: WebviewMessage[] = []

// REST API エンドポイント
app.post('/messages', (req, res) => {
  const message: WebviewMessage = req.body
  messages.push(message)
  
  // WebSocket接続中のクライアントにもブロードキャスト
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message))
    }
  })
  
  res.status(200).json({ success: true })
})

app.get('/messages', (req, res) => {
  res.json(messages)
})

// WebSocketサーバーの設定
wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected')

  ws.on('message', (data: Buffer) => {
    try {
      const message: WebviewMessage = JSON.parse(data.toString())
      messages.push(message)
      
      // 他のクライアントにブロードキャスト
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message))
        }
      })
    } catch (error) {
      console.error('Error parsing message:', error)
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected')
  })
})

// サーバー起動
server.listen(port, () => {
  console.log(`Server running on port ${port}`)
  console.log(`WebSocket server running on ws://localhost:${port}`)
  console.log(`REST API running on http://localhost:${port}`)
})