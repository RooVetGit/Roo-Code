import { z } from "zod"

export interface JobTypes {
	"github.issue.fix": {
		repo: string
		issue: number
		title: string
		body: string
		labels?: string[]
	}
}

export type JobType = keyof JobTypes

export type JobStatus = "pending" | "processing" | "completed" | "failed"

export type JobPayload<T extends JobType = JobType> = JobTypes[T]

export type JobParams<T extends JobType> = {
	jobId: number
	type: T
	payload: JobPayload<T>
}

/**
 * CreateJob
 */

export const createJobSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("github.issue.fix"),
		payload: z.object({
			repo: z.string(),
			issue: z.number(),
			title: z.string(),
			body: z.string(),
			labels: z.array(z.string()).optional(),
		}),
	}),
])

export type CreateJob = z.infer<typeof createJobSchema>

/**
 * GitHubWebhook
 */

export const githubWebhookSchema = z.object({
	action: z.string(),
	issue: z.object({
		number: z.number(),
		title: z.string(),
		body: z.string().nullable(),
		labels: z.array(z.object({ name: z.string() })),
	}),
	repository: z.object({
		full_name: z.string(),
	}),
})

export type GitHubWebhook = z.infer<typeof githubWebhookSchema>
