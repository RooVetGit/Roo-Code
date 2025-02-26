import { create } from "zustand"

import { ResearchSession, ResearchTask } from "./types"

interface ResearchSessionState {
	session?: ResearchSession
	task?: ResearchTask
}

interface ResearchSessionActions {
	setSession: (session: ResearchSession | undefined) => void
	setTask: (task: ResearchTask | undefined) => void
}

const defaultState: ResearchSessionState = {
	session: undefined,
	task: undefined,
}

export const useResearchSession = create<ResearchSessionState & ResearchSessionActions>()((set) => ({
	...defaultState,
	setSession: (session: ResearchSession | undefined) => set({ session }),
	setTask: (task: ResearchTask | undefined) => set({ task }),
}))
