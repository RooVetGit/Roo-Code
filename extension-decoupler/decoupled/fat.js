
var ZCe,
	REe,
	kEe,
	FAt = Se({
		"src/lib/responses/StatusSummary.ts"() {
			"use strict"
			wt(),
				kAt(),
				(ZCe = class {
					constructor() {
						;(this.not_added = []),
							(this.conflicted = []),
							(this.created = []),
							(this.deleted = []),
							(this.ignored = void 0),
							(this.modified = []),
							(this.renamed = []),
							(this.files = []),
							(this.staged = []),
							(this.ahead = 0),
							(this.behind = 0),
							(this.current = null),
							(this.tracking = null),
							(this.detached = !1),
							(this.isClean = () => !this.files.length)
					}
				}),
				(REe = new Map([
					Ma(" ", "A", (e, t) => Qr(e.created, t)),
					Ma(" ", "D", (e, t) => Qr(e.deleted, t)),
					Ma(" ", "M", (e, t) => Qr(e.modified, t)),
					Ma("A", " ", (e, t) => Qr(e.created, t) && Qr(e.staged, t)),
					Ma("A", "M", (e, t) => Qr(e.created, t) && Qr(e.staged, t) && Qr(e.modified, t)),
					Ma("D", " ", (e, t) => Qr(e.deleted, t) && Qr(e.staged, t)),
					Ma("M", " ", (e, t) => Qr(e.modified, t) && Qr(e.staged, t)),
					Ma("M", "M", (e, t) => Qr(e.modified, t) && Qr(e.staged, t)),
					Ma("R", " ", (e, t) => {
						Qr(e.renamed, jCe(t))
					}),
					Ma("R", "M", (e, t) => {
						let r = jCe(t)
						Qr(e.renamed, r), Qr(e.modified, r.to)
					}),
					Ma("!", "!", (e, t) => {
						Qr((e.ignored = e.ignored || []), t)
					}),
					Ma("?", "?", (e, t) => Qr(e.not_added, t)),
					...U4("A", "A", "U"),
					...U4("D", "D", "U"),
					...U4("U", "A", "D", "U"),
					[
						"##",
						(e, t) => {
							let r = /ahead (\d+)/,
								n = /behind (\d+)/,
								i = /^(.+?(?=(?:\.{3}|\s|$)))/,
								s = /\.{3}(\S*)/,
								o = /\son\s([\S]+)$/,
								a
							;(a = r.exec(t)),
								(e.ahead = (a && +a[1]) || 0),
								(a = n.exec(t)),
								(e.behind = (a && +a[1]) || 0),
								(a = i.exec(t)),
								(e.current = a && a[1]),
								(a = s.exec(t)),
								(e.tracking = a && a[1]),
								(a = o.exec(t)),
								(e.current = (a && a[1]) || e.current),
								(e.detached = /\(no branch\)/.test(t))
						},
					],
				])),
				(kEe = function (e) {
					let t = e.split(qy),
						r = new ZCe()
					for (let n = 0, i = t.length; n < i; ) {
						let s = t[n++].trim()
						s && (s.charAt(0) === "R" && (s += qy + (t[n++] || "")), MAt(r, s))
					}
					return r
				})
		},
	})