
	async function O9e(e) {
		let t = []
		for await (let r of e) t.push(r)
		return Buffer.concat(t).toString("utf8")
	}