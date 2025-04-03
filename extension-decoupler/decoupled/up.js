
function UP(e, t) {
	t === 1
		? (e.result += " ")
		: t > 1 &&
			(e.result += Ui.repeat(
				`
`,
				t - 1,
			))
}