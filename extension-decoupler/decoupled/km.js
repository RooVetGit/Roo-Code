
function KM() {
	return {
		startLineNumber: null,
		endLineNumber: null,
		newText: "",
		oldText: "",
		hasYieldedNewChunk: !1,
		currOffset: null,
		startRefined: !1,
		endRefined: !1,
		newTextBuffer: "",
		prefixOverlapChecked: !1,
	}
}