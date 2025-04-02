import { getRuns } from "@benchmark/db"

import { Home } from "./home"

export const dynamic = "force-dynamic"

export default async function Page() {
	const runs = await getRuns()
	console.log(runs)

	return <Home runs={runs} />
}
