import { create } from "zustand"

import { DeepResearchSession } from "./types"

interface SessionState {
	session?: DeepResearchSession
}

interface SessionActions {
	setSession: (session: DeepResearchSession) => void
}

const defaultState: SessionState = {
	session: undefined,
}

export const useSession = create<SessionState & SessionActions>()((set) => ({
	...defaultState,
	setSession: (session: DeepResearchSession) => set({ session }),
}))
