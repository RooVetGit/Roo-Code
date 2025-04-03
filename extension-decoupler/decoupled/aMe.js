
async function Ame(e, t) {
	let r = Du(e, t)?.absPath
	if (r !== void 0)
		try {
			return (await Ex(r)).map(([i, s]) => i)
		} catch {
			return
		}
}