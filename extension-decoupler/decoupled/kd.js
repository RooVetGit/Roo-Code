
function Kd(e) {
	let t
	if (Ix.window.activeTextEditor) {
		let r = Ix.window.activeTextEditor.document.uri.fsPath
		t = e.getFolderRoot(r)
	}
	return (
		t === void 0 &&
			((t = e.getMostRecentlyChangedFolderRoot()),
			t === void 0 && (t = Ix.workspace.workspaceFolders?.[0]?.uri.fsPath)),
		t
	)
}