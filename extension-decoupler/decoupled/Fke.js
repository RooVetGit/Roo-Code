
function fke(e) {
	if (typeof e != "object" || !e) return !1
	let t = e
	if (
		typeof t.id != "string" ||
		typeof t.checkpoints != "object" ||
		!t.checkpoints ||
		typeof t.metadata != "object" ||
		!t.metadata
	)
		return !1
	let r = t.metadata
	if (
		!Array.isArray(r.checkpointDocumentIds) ||
		typeof r.size != "number" ||
		typeof r.checkpointCount != "number" ||
		typeof r.lastModified != "number"
	)
		return !1
	let n = t.checkpoints,
		i = r.checkpointDocumentIds
	return Object.entries(n).every(([s, o]) =>
		!Array.isArray(o) || !i.includes(s)
			? !1
			: o.every((a) => {
					if (typeof a != "object" || !a) return !1
					let l = a
					return (
						typeof l.sourceToolCallRequestId == "string" &&
						typeof l.timestamp == "number" &&
						typeof l.conversationId == "string" &&
						dke(l.document)
					)
				}),
	)
}