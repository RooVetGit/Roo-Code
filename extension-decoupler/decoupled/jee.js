
var jEe,
	cmt = Se({
		"src/lib/parsers/parse-fetch.ts"() {
			"use strict"
			wt(),
				(jEe = [
					new Ft(/From (.+)$/, (e, [t]) => {
						e.remote = t
					}),
					new Ft(/\* \[new branch]\s+(\S+)\s*-> (.+)$/, (e, [t, r]) => {
						e.branches.push({ name: t, tracking: r })
					}),
					new Ft(/\* \[new tag]\s+(\S+)\s*-> (.+)$/, (e, [t, r]) => {
						e.tags.push({ name: t, tracking: r })
					}),
					new Ft(/- \[deleted]\s+\S+\s*-> (.+)$/, (e, [t]) => {
						e.deleted.push({ tracking: t })
					}),
					new Ft(/\s*([^.]+)\.\.(\S+)\s+(\S+)\s*-> (.+)$/, (e, [t, r, n, i]) => {
						e.updated.push({ name: n, tracking: i, to: r, from: t })
					}),
				])
		},
	}),
	ZEe = {}