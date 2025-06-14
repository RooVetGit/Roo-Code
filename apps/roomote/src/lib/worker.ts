import { Worker } from "bullmq"

import { redis } from "./redis"
import { processJob } from "./job"

export const worker = new Worker("roomote", processJob, {
	connection: redis,
	concurrency: 1,
	removeOnComplete: { count: 100 },
	removeOnFail: { count: 50 },
})

worker.on("completed", (job) => console.log(`Job ${job.id} completed`))
worker.on("failed", (job, err) => console.error(`Job ${job?.id} failed:`, err))
worker.on("error", (err) => console.error("Worker error:", err))

process.on("SIGTERM", async () => {
	console.log("SIGTERM -> shutting down gracefully...")
	await worker.close()
	process.exit(0)
})

process.on("SIGINT", async () => {
	console.log("SIGINT -> shutting down gracefully...")
	await worker.close()
	process.exit(0)
})

console.log("Worker process started")
