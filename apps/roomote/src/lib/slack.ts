import { JobPayload, JobType } from "@/types"
import { Logger } from "./logger"

export interface SlackMessage {
	text: string
	blocks?: unknown[]
	attachments?: unknown[]
	thread_ts?: string
	channel?: string
}

export interface SlackResponse {
	ok: boolean
	channel?: string
	ts?: string
	error?: string
	message?: Record<string, unknown>
}

export class SlackNotifier {
	private readonly logger: Logger
	private readonly token: string

	constructor(logger: Logger, token: string = process.env.SLACK_API_TOKEN!) {
		this.logger = logger
		this.token = token
	}

	private async postMessage(message: SlackMessage): Promise<string | null> {
		try {
			const messageWithChannel = { ...message, channel: message.channel || "#roomote-control" }

			const response = await fetch("https://slack.com/api/chat.postMessage", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
				body: JSON.stringify(messageWithChannel),
			})

			if (!response.ok) {
				this.logger.error(`Slack API failed: ${response.status} ${response.statusText}`)
				return null
			}

			const result: SlackResponse = await response.json()

			if (!result.ok) {
				this.logger.error(`Slack API error: ${result.error}`)
			}

			return result.ts ?? null
		} catch (error) {
			this.logger.error("Failed to send Slack message:", error)
			return null
		}
	}

	public async postTaskStarted<T extends JobType>({
		jobType,
		jobPayload,
		rooTaskId,
	}: {
		jobType: T
		jobPayload: JobPayload<T>
		rooTaskId: string
	}) {
		switch (jobType) {
			case "github.issue.fix":
				return await this.postMessage({
					text: `🚀 Task Started`,
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: `🚀 *Task Started*\nCreating a pull request for <https://github.com/RooCodeInc/Roo-Code/issues/${jobPayload.issue}|GitHub Issue #${jobPayload.issue}>`,
							},
						},
						{
							type: "context",
							elements: [
								{
									type: "mrkdwn",
									text: `jobType: ${jobType}, rooTaskId: ${rooTaskId}`,
								},
							],
						},
					],
				})
			default:
				throw new Error(`Unknown job type: ${jobType}`)
		}
	}

	public async postTaskUpdated(
		threadTs: string,
		text: string,
		status?: "info" | "success" | "warning" | "error",
	): Promise<void> {
		const emoji = { info: "ℹ️", success: "✅", warning: "⚠️", error: "❌" }[status || "info"]
		await this.postMessage({ text: `${emoji} ${text}`, thread_ts: threadTs })
	}

	public async postTaskCompleted(
		threadTs: string,
		success: boolean,
		duration: number,
		taskId?: string,
	): Promise<void> {
		const status = success ? "✅ Completed" : "❌ Failed"
		const durationText = `${Math.round(duration / 1000)}s`

		await this.postMessage({
			text: `${status} Task finished in ${durationText}`,
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `*${status}*\n*Task ID:* ${taskId || "Unknown"}\n*Duration:* ${durationText}`,
					},
				},
				{
					type: "context",
					elements: [
						{
							type: "mrkdwn",
							text: `Finished at: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
						},
					],
				},
			],
			thread_ts: threadTs,
		})
	}
}
