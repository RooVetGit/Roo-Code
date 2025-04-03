
function Dxe(e, t) {
	return `context:
    text: ${t.selectedCompletionInfo?.text}
    range: ${AC(e, t.selectedCompletionInfo?.range)}
    triggerKind: ${t.triggerKind}`
}