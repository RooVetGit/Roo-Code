
async function vk(e) {
	let t = e()
	return !t || !Pn(t) ? void 0 : (await Fr(t)).replace(/^\s+/, "")
}