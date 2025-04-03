
function Ye(e, t = !1) {
	if (e instanceof Error) {
		if (t) {
			let r = met(e)
			if (r !== "") return `${e.message} (due to ${r})`
		}
		return e.message
	}
	return String(e)
}