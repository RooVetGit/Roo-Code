import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db, cloudJobs } from "@/db"

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
	try {
		const { id } = await params
		const jobId = parseInt(id, 10)

		if (isNaN(jobId)) {
			return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
		}

		const [job] = await db.select().from(cloudJobs).where(eq(cloudJobs.id, jobId)).limit(1)

		if (!job) {
			return NextResponse.json({ error: "Job not found" }, { status: 404 })
		}

		return NextResponse.json({
			id: job.id,
			type: job.type,
			status: job.status,
			payload: job.payload,
			result: job.result,
			error: job.error,
			createdAt: job.createdAt,
			startedAt: job.startedAt,
			completedAt: job.completedAt,
		})
	} catch (error) {
		console.error("Error fetching job:", error)
		return NextResponse.json({ error: "Internal server error" }, { status: 500 })
	}
}
