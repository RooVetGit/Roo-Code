
function v$(e) {
	try {
		let t = { id: e.id, checkpoints: {}, metadata: e.getMetadata() }
		for (let r of e.checkpointDocumentIds) {
			let n = e.getCheckpointsById(r)
			n && (t.checkpoints[r] = n.map(cke))
		}
		return t
	} catch (t) {
		throw new Df(`Failed to serialize shard: ${t instanceof Error ? t.message : String(t)}`)
	}
}