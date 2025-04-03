
async function* ndt(e, t, r, n) {
	let i = new Set(),
		s = [],
		o = new Ia(async (l) => {
			if (l === void 0) return
			let c = [l, await n(l)]
			s.push(c)
		})
	t && (i.add(t), o.insert(t)), o.kick()
	for await (let l of r) {
		OW(l.workspaceFileChunks ?? []).forEach((f) => {
			i.add(f), o.insert(f)
		}),
			o.kick()
		let u = [...s]
		u.forEach(([f, p]) => {
			i.delete(f)
		}),
			(s = []),
			yield {
				type: "chat-model-reply",
				data: {
					text: l.text,
					requestId: e,
					streaming: !0,
					workspaceFileChunks: u.map(([f, p]) => p),
					nodes: l.nodes,
				},
			}
	}
	let a = await Promise.all([...OW([...i]).map(n)])
	yield {
		type: "chat-model-reply",
		data: { text: "", requestId: e, streaming: !0, workspaceFileChunks: a },
	}
}