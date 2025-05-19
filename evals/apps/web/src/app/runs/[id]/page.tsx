import { findRun } from "@evals/db"

import { Run } from "./run"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const run = await findRun(Number(id))

	return (
		<div className="container mx-auto py-6">
			<Run run={run} />
		</div>
	)
}
