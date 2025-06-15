import { Worker } from "bullmq"

import { redis } from "./redis"
import { processJob } from "./job"

async function processSingleJob() {
	const worker = new Worker("roomote", processJob, { connection: redis })

	try {
		console.log("Looking for a job to process...")
		const job = await worker.getNextJob("worker-token")

		if (!job) {
			console.log("No jobs available, exiting...")
			await worker.close()
			process.exit(0)
		}

		console.log(`Processing job ${job.id}...`)

		try {
			await processJob(job)
			await job.moveToCompleted(undefined, "worker-token")
			console.log(`Job ${job.id} completed successfully`)
		} catch (error) {
			await job.moveToFailed(error as Error, "worker-token")
			console.error(`Job ${job.id} failed:`, error)
		}
	} catch (error) {
		console.error("Error processing job:", error)
	} finally {
		await worker.close()
		process.exit(0)
	}
}

process.on("SIGTERM", async () => {
	console.log("SIGTERM -> shutting down gracefully...")
	process.exit(0)
})

process.on("SIGINT", async () => {
	console.log("SIGINT -> shutting down gracefully...")
	process.exit(0)
})

console.log("Single job worker started")
processSingleJob()
