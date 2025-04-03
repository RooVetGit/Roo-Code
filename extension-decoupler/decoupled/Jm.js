
function jM(e, t) {
	return {
		lineChange: {
			originalStartLineNumber: e.lineChange.originalStartLineNumber + t,
			originalEndLineNumber: e.lineChange.originalEndLineNumber + t,
			modifiedStartLineNumber: e.lineChange.modifiedStartLineNumber + t,
			modifiedEndLineNumber: e.lineChange.modifiedEndLineNumber + t,
		},
		newText: e.newText,
	}
}