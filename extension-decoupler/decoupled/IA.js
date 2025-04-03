
async function iA(e, t = void 0) {
	let r = (0, _be.resolve)(e.repoRoot, e.pathName)
	e.differentTab
		? t === void 0 || $r.window.tabGroups.all.length === 1
			? await $r.commands.executeCommand("vscode.openWith", $r.Uri.file(r), "default", $r.ViewColumn.Beside)
			: await $r.commands.executeCommand(
					"vscode.openWith",
					$r.Uri.file(r),
					"default",
					t === $r.ViewColumn.One ? t + 1 : t - 1,
				)
		: await $r.commands.executeCommand("vscode.open", $r.Uri.file(r))
	let n
	if (!(!$r.window.activeTextEditor || $r.window.activeTextEditor.document.uri.fsPath !== r)) {
		if (e.fullRange) {
			let i = e.fullRange
			n = $r.window.activeTextEditor.document.validateRange(
				new $r.Range(i.startLineNumber, i.startColumn, i.endLineNumber, i.endColumn),
			)
		} else if (e.range) {
			let i = e.range
			n = $r.window.activeTextEditor.document.validateRange(new $r.Range(i.start - 1, 0, i.stop - 1, 999))
		} else if (e.snippet) {
			let s = (await $r.workspace.openTextDocument(r)).getText(),
				o = xbe(s, e.snippet)
			if (o === null) {
				let a = $r.window.activeTextEditor.selection.active
				n = $r.window.activeTextEditor.document.validateRange(new $r.Range(a, a))
			} else n = $r.window.activeTextEditor.document.validateRange(new $r.Range(o.start, 0, o.end, 999))
		} else return
		$r.window.activeTextEditor?.revealRange(n),
			($r.window.activeTextEditor.selection = new $r.Selection(n.end, n.start))
	}
}