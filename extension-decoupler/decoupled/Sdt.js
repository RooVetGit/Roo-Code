
function sdt(e, t) {
	return (
		e.agentMemories
			? (e.agentMemories += `
`)
			: (e.agentMemories = ""),
		(e.agentMemories += idt.replaceAll("${relPath}", t)),
		e
	)
}