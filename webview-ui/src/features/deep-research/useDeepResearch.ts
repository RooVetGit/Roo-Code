import { useContext } from "react"

import { DeepResearchContext } from "./DeepResearchProvider"

export function useDeepResearch() {
	const context = useContext(DeepResearchContext)

	if (context === undefined) {
		throw new Error("useDeepResearch must be used within a DeepResearchProvider")
	}

	return context
}
