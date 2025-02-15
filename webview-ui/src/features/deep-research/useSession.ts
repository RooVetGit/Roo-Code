import { create } from "zustand"

import { Session } from "./types"

interface SessionState {
	session?: Session
}

interface SessionActions {
	setSession: (session: Session | undefined) => void
}

const defaultState: SessionState = {
	session: undefined,
}

export const useSession = create<SessionState & SessionActions>()((set) => ({
	...defaultState,
	setSession: (session: Session | undefined) => set({ session }),
}))
