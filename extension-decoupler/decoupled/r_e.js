
async function* R_e(e) {
	;(0, yQ.default)(e.pathName)
	let t = await BC.workspace.openTextDocument(Je.from(e.pathName).absPath),
		r = CQ(e.pathName)
	;(0, yQ.default)(Pn(r))
	let n = T_e.default.parse((await BC.workspace.openTextDocument(r)).getText()),
		i = t.getText(),
		s = 0
	for await (let o of n)
		(o.path = o.path ?? e.pathName?.relPath),
			(o.blobName = e.blobName ?? ""),
			(o.suggestionId = o.suggestionId ?? `mock-suggestion-${o.blobName}-${s++}`),
			(o.charStart = o.charStart ?? t.offsetAt(new BC.Position(o.lineStart, 0))),
			(o.charEnd = o.charEnd ?? t.offsetAt(new BC.Position(o.lineEnd, 0))),
			(o.diffSpans =
				o.diffSpans ??
				(o.existingCode != null && o.suggestedCode != null
					? dyt(o.existingCode, o.suggestedCode)
					: [
							{
								original: { start: o.charStart, stop: o.charEnd },
								updated: { start: o.charStart, stop: o.charEnd },
							},
						])),
			(o.existingCode = o.existingCode?.replaceAll("|", "") ?? i.substring(o.charStart, o.charEnd)),
			(o.suggestedCode = o.suggestedCode?.replaceAll("|", "") ?? i.substring(o.charStart, o.charEnd)),
			(o.changeDescription = o.changeDescription ?? ""),
			(o.editingScore = o.editingScore ?? 1),
			(o.localizationScore = o.localizationScore ?? 1),
			(o.editingScoreThreshold = o.editingScoreThreshold ?? 1),
			yield { result: o, unknownBlobNames: [], checkpointNotFound: !1 }
}