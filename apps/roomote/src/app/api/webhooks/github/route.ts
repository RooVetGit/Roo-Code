import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { z } from "zod"

import { type JobType, type JobPayload, githubWebhookSchema } from "@/types"
import { db, cloudJobs } from "@/db"
import { enqueue } from "@/lib"

function verifySignature(body: string, signature: string, secret: string): boolean {
	const expectedSignature = createHmac("sha256", secret).update(body, "utf8").digest("hex")
	const receivedSignature = signature.replace("sha256=", "")
	return expectedSignature === receivedSignature
}

export async function POST(request: NextRequest) {
	try {
		const signature = request.headers.get("x-hub-signature-256")

		if (!signature) {
			return NextResponse.json({ error: "missing_signature" }, { status: 400 })
		}

		const body = await request.text()

		if (!verifySignature(body, signature, process.env.GH_WEBHOOK_SECRET!)) {
			return NextResponse.json({ error: "invalid_signature" }, { status: 401 })
		}

		const event = request.headers.get("x-github-event")

		if (event !== "issues") {
			return NextResponse.json({ message: "event_ignored" })
		}

		const data = githubWebhookSchema.parse(JSON.parse(body))
		console.log("🗄️ Webhook ->", data)
		const { action, repository, issue } = data

		if (action !== "opened") {
			return NextResponse.json({ message: "action_ignored" })
		}

		const type: JobType = "github.issue.fix"

		const payload: JobPayload<typeof type> = {
			repo: repository.full_name,
			issue: issue.number,
			title: issue.title,
			body: issue.body || "",
			labels: issue.labels.map(({ name }) => name),
		}

		const [job] = await db.insert(cloudJobs).values({ type, payload, status: "pending" }).returning()

		if (!job) {
			throw new Error("Failed to create `cloudJobs` record.")
		}

		const enqueuedJob = await enqueue({ jobId: job.id, type, payload })
		console.log("🔗 Enqueued job ->", enqueuedJob)

		return NextResponse.json({ message: "job_enqueued", jobId: job.id, enqueuedJobId: enqueuedJob.id })
	} catch (error) {
		console.error("GitHub Webhook Error:", error)

		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: "bad_request", details: error.errors }, { status: 400 })
		}

		return NextResponse.json({ error: "internal_server_error" }, { status: 500 })
	}
}
