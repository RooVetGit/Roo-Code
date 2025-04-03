
function qct(e) {
	return e === void 0
		? { num_lines: -1, num_chars: -1 }
		: {
				num_lines: e.split(`
`).length,
				num_chars: e.length,
			}
}