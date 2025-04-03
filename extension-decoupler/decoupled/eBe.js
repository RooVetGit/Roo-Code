
async function* Ebe(e) {
	for await (let t of e)
		Wn(t.replacementOldText) || (yield { text: "", replacementOldText: t.replacementOldText }),
			Wn(t.replacementStartLine) || (yield { text: "", replacementStartLine: t.replacementStartLine }),
			Wn(t.replacementText) || (yield { text: "", replacementText: t.replacementText }),
			Wn(t.replacementEndLine) || (yield { text: "", replacementEndLine: t.replacementEndLine })
}