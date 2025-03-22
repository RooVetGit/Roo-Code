"use server"

import { spawn } from "child_process"
import path from "path"
import os from "os"

import { revalidatePath } from "next/cache"

import * as db from "@benchmark/db"

export async function createRun(data: Omit<db.InsertRun, "socketPath">) {
	const socketPath = path.join(os.tmpdir(), `benchmark-${crypto.randomUUID()}.sock`)
	const run = await db.createRun({ ...data, socketPath })
	revalidatePath("/runs")

	try {
		const process = spawn(
			"pnpm",
			["--filter", "@benchmark/cli", "dev", "run", "all", "--runId", run.id.toString()],
			{
				detached: true,
				stdio: "ignore",
			},
		)

		process.unref()
		await db.updateRun(run.id, { pid: process.pid })
	} catch (error) {
		console.error(error)
	}

	return run
}
