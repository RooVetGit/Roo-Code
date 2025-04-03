
function b0t(e, t) {
	return {
		enableAutoApply: e.nextEdit.enableAutoApply,
		showDiffInHover: e.nextEdit.showDiffInHover,
		enablePanel: e.nextEdit.enableBottomPanel ?? Gr(t.currentFlags.vscodeNextEditBottomPanelMinVersion) ?? !1,
	}
}