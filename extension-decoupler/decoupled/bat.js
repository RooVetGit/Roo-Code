
var KCe,
	SEe,
	JCe,
	BAt = Se({
		"src/lib/parsers/parse-push.ts"() {
			"use strict"
			wt(),
				xEe(),
				(KCe = [
					new Ft(/^Pushing to (.+)$/, (e, [t]) => {
						e.repo = t
					}),
					new Ft(/^updating local tracking ref '(.+)'/, (e, [t]) => {
						e.ref = Jx(_l({}, e.ref || {}), { local: t })
					}),
					new Ft(/^[=*-]\s+([^:]+):(\S+)\s+\[(.+)]$/, (e, [t, r, n]) => {
						e.pushed.push(SAt(t, r, n))
					}),
					new Ft(
						/^Branch '([^']+)' set up to track remote branch '([^']+)' from '([^']+)'/,
						(e, [t, r, n]) => {
							e.branch = Jx(_l({}, e.branch || {}), {
								local: t,
								remote: r,
								remoteName: n,
							})
						},
					),
					new Ft(/^([^:]+):(\S+)\s+([a-z0-9]+)\.\.([a-z0-9]+)$/, (e, [t, r, n, i]) => {
						e.update = {
							head: { local: t, remote: r },
							hash: { from: n, to: i },
						}
					}),
				]),
				(SEe = (e, t) => {
					let r = JCe(e, t),
						n = vEe(e, t)
					return _l(_l({}, r), n)
				}),
				(JCe = (e, t) => Zo({ pushed: [] }, KCe, [e, t]))
		},
	}),
	BEe = {}