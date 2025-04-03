
var lG,
	cG,
	uG,
	TM,
	dG,
	Ove = Se({
		"src/lib/tasks/clean.ts"() {
			"use strict"
			mpt(),
				wt(),
				Ci(),
				(lG = "Git clean interactive mode is not supported"),
				(cG = 'Git clean mode parameter ("n" or "f") is required'),
				(uG = "Git clean unknown option found in: "),
				(TM = ((e) => (
					(e.DRY_RUN = "n"),
					(e.FORCE = "f"),
					(e.IGNORED_INCLUDED = "x"),
					(e.IGNORED_ONLY = "X"),
					(e.EXCLUDING = "e"),
					(e.QUIET = "q"),
					(e.RECURSIVE = "d"),
					e
				))(TM || {})),
				(dG = new Set(["i", ...yve(Object.values(TM))]))
		},
	})