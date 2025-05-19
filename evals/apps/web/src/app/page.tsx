import { getRuns } from "@evals/db"

import { Home } from "./home"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
	// Parse pagination parameters from URL
	const params = await searchParams
	const page = params.page ? parseInt(params.page, 10) : 1
	const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20

	// Get paginated runs
	const { data: runs, pagination } = await getRuns(page, pageSize)

	return <Home runs={runs} pagination={pagination} />
}
