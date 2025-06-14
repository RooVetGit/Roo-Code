import IORedis from "ioredis"
import { Queue } from "bullmq"
import { ExpressAdapter } from "@bull-board/express"
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { createBullBoard } from "@bull-board/api"
import express from "express"
import type { Express, Request, Response } from "express"

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6380", { maxRetriesPerRequest: null })
const queue = new Queue("roomote", { connection: redis })

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath("/admin/queues")
createBullBoard({ queues: [new BullMQAdapter(queue)], serverAdapter })

const port = 3002
const app: Express = express()
app.use("/admin/queues", serverAdapter.getRouter())
app.use("/", (req: Request, res: Response) => res.redirect("/admin/queues"))
app.listen(port, () => console.log(`Bull Board running on: http://localhost:${port}/admin/queues`))
