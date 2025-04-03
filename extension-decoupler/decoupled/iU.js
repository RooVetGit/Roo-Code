
async function Iu(e) {
	return new Promise((t) => {
		let r = e((n) => {
			r.dispose(), t(n)
		})
	})
}