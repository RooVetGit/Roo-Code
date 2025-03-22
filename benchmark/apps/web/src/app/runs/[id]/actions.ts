"use server"

import { revalidatePath } from "next/cache"

import * as db from "@benchmark/db"

export async function getTasks(runId: number) {
	const tasks = await db.getTasks(runId)
	revalidatePath(`/runs/${runId}`)
	return tasks
}
