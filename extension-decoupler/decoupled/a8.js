
function A8(e, t) {
	return (
		e.mode === t.mode &&
		(e.scope === t.scope || (e.scope === "CURSOR" && t.scope === "FILE")) &&
		(e.scope === "WORKSPACE" || Je.equals(e.qualifiedPathName, t.qualifiedPathName)) &&
		!(
			e.scope !== "WORKSPACE" &&
			e.requestBlobName &&
			t.requestBlobName &&
			e.requestBlobName !== t.requestBlobName
		) &&
		!(
			e.scope === "CURSOR" &&
			e.selection?.start != null &&
			t.selection?.start != null &&
			Math.abs(e.selection.start - t.selection.start) > Ayt
		)
	)
}