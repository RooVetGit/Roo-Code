
function wl(...e) {
	let t = {
		scripts: new Set(),
		styles: new Set(["'unsafe-inline'"]),
		fonts: new Set(),
		images: new Set(),
		media: new Set(),
		workers: new Set(),
		connects: new Set(),
	}
	for (let i of e) i(t)
	let r = ["default-src 'none';"],
		n = {
			"font-src": t.fonts,
			"style-src": t.styles,
			"script-src": t.scripts,
			"img-src": t.images,
			"media-src": t.media,
			"worker-src": t.workers,
			"connect-src": t.connects,
		}
	for (let [i, s] of Object.entries(n)) {
		let o = Array.from(s).sort()
		o.length !== 0 && r.push(`${i} ${o.join(" ")};`)
	}
	return r.join(" ")
}