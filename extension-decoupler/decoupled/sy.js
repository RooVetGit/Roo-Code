
async function Sy(e, t) {
	let r = Du(e, t)?.absPath
	if (r !== void 0)
		try {
			return (await ho(r)).getText()
		} catch {
			return
		}
}