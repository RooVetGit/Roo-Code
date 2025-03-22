import { findRun } from "@benchmark/db"

import { Run } from "./run"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const run = await findRun(Number(id))
	return <Run run={run} />
}
