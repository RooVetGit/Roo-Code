
function C$(e) {
	let t = y$(e.id)
	if (!t.isValid) return t
	let r = uI({
		version: 1,
		lastUpdated: Date.now(),
		shards: { [e.id]: e.metadata },
	})
	if (!r.isValid) return r
	if (typeof e.checkpoints != "object" || !e.checkpoints)
		return { isValid: !1, reason: "Missing or invalid checkpoints object" }
	for (let [s, o] of Object.entries(e.checkpoints)) {
		if (typeof s != "string" || s.length === 0) return { isValid: !1, reason: `Invalid checkpoint ID: ${s}` }
		if (!Array.isArray(o))
			return {
				isValid: !1,
				reason: `Checkpoints for ID ${s} must be an array`,
			}
		for (let a of o)
			if (
				typeof a != "object" ||
				!a ||
				typeof a.sourceToolCallRequestId != "string" ||
				typeof a.timestamp != "number" ||
				typeof a.document != "object" ||
				!a.document ||
				typeof a.document.originalCode != "string" ||
				typeof a.document.modifiedCode != "string" ||
				typeof a.document.path != "object" ||
				!a.document.path ||
				typeof a.document.path.rootPath != "string" ||
				typeof a.document.path.relPath != "string"
			)
				return {
					isValid: !1,
					reason: `Invalid checkpoint structure in ID ${s}`,
				}
	}
	let n = new Set(Object.keys(e.checkpoints)),
		i = new Set(e.metadata.checkpointDocumentIds)
	if (n.size !== i.size)
		return {
			isValid: !1,
			reason: "Mismatch between checkpoint IDs in metadata and actual checkpoints",
		}
	for (let s of n)
		if (!i.has(s))
			return {
				isValid: !1,
				reason: "Mismatch between checkpoint IDs in metadata and actual checkpoints",
			}
	return { isValid: !0 }
}