
function OAe(e) {
	let t = "${workspaceFolder}"
	if (!e.includes(t)) return e
	let r = bc.workspace.workspaceFolders?.length ?? 0
	r !== 1 &&
		X("AugmentConfigListener").warn(
			`Variable ${t} cannot be expanded because there are ${r} workspace folders open.`,
		)
	let n = bc.workspace.workspaceFolders?.[0]?.uri
	return n && (e = e.replaceAll(t, n.fsPath)), e
}