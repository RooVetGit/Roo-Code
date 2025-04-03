
function qP(e, t) {
	return function () {
		throw new Error(
			"Function yaml." +
				e +
				" is removed in js-yaml 4. Use yaml." +
				t +
				" instead, which is now safe by default.",
		)
	}
}