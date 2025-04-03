
function Gpt(e) {
	let t = (n) => {
		console.warn(
			`simple-git deprecation notice: accessing GitResponseError.${n} should be GitResponseError.git.${n}, this will no longer be available in version 3`,
		),
			(t = nA)
	}
	return Object.create(e, Object.getOwnPropertyNames(e.git).reduce(r, {}))
	function r(n, i) {
		return (
			i in e ||
				(n[i] = {
					enumerable: !1,
					configurable: !1,
					get() {
						return t(i), e.git[i]
					},
				}),
			n
		)
	}
}