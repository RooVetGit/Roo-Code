
var P4,
	NCe,
	PCe,
	LCe,
	cEe,
	uEe = Se({
		"src/lib/parsers/parse-diff-summary.ts"() {
			"use strict"
			i_(),
				gAt(),
				Gve(),
				wt(),
				(P4 = [
					new Ft(/^(.+)\s+\|\s+(\d+)(\s+[+\-]+)?$/, (e, [t, r, n = ""]) => {
						e.files.push({
							file: t.trim(),
							changes: mn(r),
							insertions: n.replace(/[^+]/g, "").length,
							deletions: n.replace(/[^-]/g, "").length,
							binary: !1,
						})
					}),
					new Ft(/^(.+) \|\s+Bin ([0-9.]+) -> ([0-9.]+) ([a-z]+)/, (e, [t, r, n]) => {
						e.files.push({
							file: t.trim(),
							before: mn(r),
							after: mn(n),
							binary: !0,
						})
					}),
					new Ft(/(\d+) files? changed\s*((?:, \d+ [^,]+){0,2})/, (e, [t, r]) => {
						let n = /(\d+) i/.exec(r),
							i = /(\d+) d/.exec(r)
						;(e.changed = mn(t)), (e.insertions = mn(n?.[1])), (e.deletions = mn(i?.[1]))
					}),
				]),
				(NCe = [
					new Ft(/(\d+)\t(\d+)\t(.+)$/, (e, [t, r, n]) => {
						let i = mn(t),
							s = mn(r)
						e.changed++,
							(e.insertions += i),
							(e.deletions += s),
							e.files.push({
								file: n,
								changes: i + s,
								insertions: i,
								deletions: s,
								binary: !1,
							})
					}),
					new Ft(/-\t-\t(.+)$/, (e, [t]) => {
						e.changed++, e.files.push({ file: t, after: 0, before: 0, binary: !0 })
					}),
				]),
				(PCe = [
					new Ft(/(.+)$/, (e, [t]) => {
						e.changed++,
							e.files.push({
								file: t,
								changes: 0,
								insertions: 0,
								deletions: 0,
								binary: !1,
							})
					}),
				]),
				(LCe = [
					new Ft(/([ACDMRTUXB])([0-9]{0,3})\t(.[^\t]*)(\t(.[^\t]*))?$/, (e, [t, r, n, i, s]) => {
						e.changed++,
							e.files.push({
								file: s ?? n,
								changes: 0,
								insertions: 0,
								deletions: 0,
								binary: !1,
								status: q4(kpt(t) && t),
								from: q4(!!s && n !== s && n),
								similarity: mn(r),
							})
					}),
				]),
				(cEe = {
					"": P4,
					"--stat": P4,
					"--numstat": NCe,
					"--name-status": LCe,
					"--name-only": PCe,
				})
		},
	})