
var OCe,
	qCe,
	VCe,
	HCe,
	_Ee,
	WCe,
	vG,
	wEe = Se({
		"src/lib/parsers/parse-pull.ts"() {
			"use strict"
			bAt(),
				wt(),
				xEe(),
				(OCe = /^\s*(.+?)\s+\|\s+\d+\s*(\+*)(-*)/),
				(qCe = /(\d+)\D+((\d+)\D+\(\+\))?(\D+(\d+)\D+\(-\))?/),
				(VCe = /^(create|delete) mode \d+ (.+)/),
				(HCe = [
					new Ft(OCe, (e, [t, r, n]) => {
						e.files.push(t), r && (e.insertions[t] = r.length), n && (e.deletions[t] = n.length)
					}),
					new Ft(qCe, (e, [t, , r, , n]) =>
						r !== void 0 || n !== void 0
							? ((e.summary.changes = +t || 0),
								(e.summary.insertions = +r || 0),
								(e.summary.deletions = +n || 0),
								!0)
							: !1,
					),
					new Ft(VCe, (e, [t, r]) => {
						Qr(e.files, r), Qr(t === "create" ? e.created : e.deleted, r)
					}),
				]),
				(_Ee = [
					new Ft(/^from\s(.+)$/i, (e, [t]) => void (e.remote = t)),
					new Ft(/^fatal:\s(.+)$/, (e, [t]) => void (e.message = t)),
					new Ft(/([a-z0-9]+)\.\.([a-z0-9]+)\s+(\S+)\s+->\s+(\S+)$/, (e, [t, r, n, i]) => {
						;(e.branch.local = n), (e.hash.local = t), (e.branch.remote = i), (e.hash.remote = r)
					}),
				]),
				(WCe = (e, t) => Zo(new z4(), HCe, [e, t])),
				(vG = (e, t) => Object.assign(new z4(), WCe(e, t), vEe(e, t)))
		},
	}),
	GCe,
	IEe,
	$Ce,
	wAt = Se({
		"src/lib/parsers/parse-merge.ts"() {
			"use strict"
			EAt(),
				wt(),
				wEe(),
				(GCe = [
					new Ft(/^Auto-merging\s+(.+)$/, (e, [t]) => {
						e.merges.push(t)
					}),
					new Ft(/^CONFLICT\s+\((.+)\): Merge conflict in (.+)$/, (e, [t, r]) => {
						e.conflicts.push(new MM(t, r))
					}),
					new Ft(/^CONFLICT\s+\((.+\/delete)\): (.+) deleted in (.+) and/, (e, [t, r, n]) => {
						e.conflicts.push(new MM(t, r, { deleteRef: n }))
					}),
					new Ft(/^CONFLICT\s+\((.+)\):/, (e, [t]) => {
						e.conflicts.push(new MM(t, null))
					}),
					new Ft(/^Automatic merge failed;\s+(.+)$/, (e, [t]) => {
						e.result = t
					}),
				]),
				(IEe = (e, t) => Object.assign($Ce(e, t), vG(e, t))),
				($Ce = (e) => Zo(new mEe(), GCe, e))
		},
	})