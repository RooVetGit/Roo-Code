
function PAe(e) {
	if (ek(AbortSignal, "any") && typeof AbortSignal.any == "function") return AbortSignal.any(e)
	let t = new AbortController()
	if (e.some((i) => i.aborted)) return t.abort(), t.signal
	let r = [],
		n = () => {
			t.abort(), r.forEach((i) => i())
		}
	for (let i of e) i.addEventListener("abort", n), r.push(() => i.removeEventListener("abort", n))
	return t.signal
}