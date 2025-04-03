
var W4,
	HM,
	aG,
	Dve = Se({
		"src/lib/tasks/check-is-repo.ts"() {
			"use strict"
			wt(),
				(W4 = ((e) => ((e.BARE = "bare"), (e.IN_TREE = "tree"), (e.IS_REPO_ROOT = "root"), e))(W4 || {})),
				(HM = ({ exitCode: e }, t, r, n) => {
					if (e === 128 && ppt(t)) return r(Buffer.from("false"))
					n(t)
				}),
				(aG = (e) => e.trim() === "true")
		},
	})