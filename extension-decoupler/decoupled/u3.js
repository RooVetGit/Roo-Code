
function u3() {
	return NT > PT.length - 16 && (Cue.default.randomFillSync(PT), (NT = 0)), PT.slice(NT, (NT += 16))
}