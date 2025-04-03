
function Rbe(e) {
	return e === void 0
		? rf.window.activeTextEditor?.document.uri
		: e === null
			? null
			: e instanceof rf.Uri
				? e
				: rf.Uri.parse(e)
}