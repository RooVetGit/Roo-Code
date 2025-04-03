
async function Ibe(e, t, r) {
	if (!a_()) throw new Error("Not in HMR mode")
	let n = await fetch(`${e}/${t}`)
	if (!n.ok) throw new Error(`Failed to load ${t} from ${e}: ${n.statusText}`)
	let i = await n.text()
	if (!i?.trim()) throw new Error(`Empty response when loading ${t} from ${e}: ${n.statusText}`)
	return xG(i, e, r)
}