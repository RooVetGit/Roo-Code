import { eq } from "drizzle-orm"
import { Job } from "bullmq"

import { db, cloudJobs, type UpdateCloudJob } from "@/db"
import type { JobType, JobStatus, JobParams } from "@/types"

import { fixGitHubIssue } from "./jobs/fixGitHubIssue"

export async function processJob<T extends JobType>({ data: { type, payload, jobId }, ...job }: Job<JobParams<T>>) {
	console.log(`[${job.name} | ${job.id}] Processing job ${jobId} of type ${type}`)

	try {
		await updateJobStatus(jobId, "processing")
		let result: unknown

		switch (type) {
			case "github.issue.fix":
				result = await fixGitHubIssue(payload)
				break
			default:
				throw new Error(`Unknown job type: ${type}`)
		}

		await updateJobStatus(jobId, "completed", result)
		console.log(`[${job.name} | ${job.id}] Job ${jobId} completed successfully`)
	} catch (error) {
		console.error(`[${job.name} | ${job.id}] Job ${jobId} failed:`, error)
		const errorMessage = error instanceof Error ? error.message : String(error)
		await updateJobStatus(jobId, "failed", undefined, errorMessage)
		throw error // Re-throw to mark job as failed in BullMQ.
	}
}

async function updateJobStatus(jobId: number, status: JobStatus, result?: unknown, error?: string) {
	const values: UpdateCloudJob = { status }

	if (status === "processing") {
		values.startedAt = new Date()
	} else if (status === "completed" || status === "failed") {
		values.completedAt = new Date()

		if (result) {
			values.result = result
		}

		if (error) {
			values.error = error
		}
	}

	await db.update(cloudJobs).set(values).where(eq(cloudJobs.id, jobId))
}
