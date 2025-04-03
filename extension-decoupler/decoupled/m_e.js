
async function* M_e(e, t, r, n, i, s, o, a) {
	let l = X("queryNextEditStream")
	if (o.isCancellationRequested) {
		l.debug("Skipping Next Edit with cancelled token."), yield { status: He.cancelled }
		return
	}
	if (!p8(t, s, e.pathName, e.fileEditEvents)) {
		l.debug("Skipping Next Edit with no changes."), yield { status: He.ok }
		return
	}
	let u = s.config.nextEdit.useMockResults && e.pathName && Pn(CQ(e.pathName)),
		f = k_e(t, e.pathName),
		p = e.fileEditEvents ?? t.getFileEditEvents(f),
		g = f ? t.getRepoRootForFolderRoot(f) : void 0,
		m = e.pathName && Je.from(e.pathName),
		y = m?.rootPath ?? g,
		C = t.getContext()
	e = {
		...e,
		blobName: e.blobName ?? (m && t.getBlobName(m)),
		blobs: e.blobs ?? C.blobs,
		recentChanges: e.recentChanges ?? By(C.recentChunks.filter((b) => !b.uploaded)),
		fileEditEvents: p,
		unindexedEditEvents: e.unindexedEditEvents.length > 0 ? e.unindexedEditEvents : C.unindexedEditEvents,
		unindexedEditEventsBaseBlobNames:
			e.unindexedEditEventsBaseBlobNames.length > 0
				? e.unindexedEditEventsBaseBlobNames
				: C.unindexedEditEventsBaseBlobNames,
		diagnostics: await pyt(r, y, i, t),
	}
	let v = new g8(e.requestId, t)
	l.debug(`[${e.requestId}] Starting request for ${m?.relPath} (mode=${e.mode}, scope=${e.scope}).`)
	try {
		let b
		if ((u ? (b = R_e(e)) : (b = await n.nextEditStream(e)), o.isCancellationRequested)) {
			l.debug(`[${e.requestId}] Skipping next edit with cancelled token.`), yield { status: He.cancelled }
			return
		}
		for await (let w of b) {
			let B = `[${e.requestId}/${w.result.suggestionId}]`
			if (
				(w.unknownBlobNames.length > 0 &&
					(t.handleUnknownBlobs(C, w.unknownBlobNames),
					l.warn(`${B} Found ${w.unknownBlobNames.length} unknown blobs.`)),
				w.checkpointNotFound &&
					(t.handleUnknownCheckpoint(e.requestId, e.blobs.checkpointId),
					l.warn(`${B} Checkpoint was not found.`)),
				o.isCancellationRequested)
			) {
				l.debug(`${B} Cancelled by the client.`), yield { status: He.cancelled }
				return
			}
			let M = await gyt(w.result.path, y, t),
				Q = M && t.safeResolvePathName(M.uri)
			if (o.isCancellationRequested) {
				l.debug(`${B} Cancelled by the client.`), yield { status: He.cancelled }
				return
			}
			if (!Q) {
				l.warn(`${B} Response path ${w.result.path} has no document.`),
					a.reportEvent(
						e.requestId,
						w.result.suggestionId,
						Date.now(),
						"error-no-document-for-response",
						"unknown",
					)
				continue
			}
			if (M?.uri.scheme === "file" && !Pn(Q.absPath)) {
				l.warn(`${B} Response path ${Q.relPath} does not exist.`),
					a.reportEvent(
						e.requestId,
						w.result.suggestionId,
						Date.now(),
						"error-response-file-is-deleted",
						"unknown",
					)
				continue
			}
			let O = M.getText(),
				Y = tW(O, w.result.charStart),
				j = tW(O, w.result.charEnd),
				ne = v.updateWithPendingEdits(Q, new bo(Y, j))
			if (!ne) {
				l.debug(`${B} Response was invalidated by pending edits.`), yield { status: He.invalidArgument }
				return
			}
			let q = new Ys.Range(M.positionAt(ne.start), M.positionAt(ne.stop)),
				me = M.lineAt(q.end.line)
			if (
				(me.range.isEqual(me.rangeIncludingLineBreak) &&
					q.end.line === M.lineCount - 1 &&
					q.end.character === me.range.end.character &&
					!q.isEmpty &&
					(q = q.with({ end: new Ys.Position(q.end.line + 1, 0) })),
				q.start.character !== 0 || q.end.character !== 0)
			) {
				if (
					(l.warn(`${B} Response was not line-aligned ${s_e(q)}.`),
					l.debug(`${B} Converting char range ${w.result.charStart}-${w.result.charEnd} to ${Y}-${j}.`),
					l.debug(`${B} Updated char range to ${ne?.start}-${ne?.stop}.`),
					l.debug(
						`${B} The bad line is: "${M.lineAt(q.end.character !== 0 ? q.end.line : q.start.line).text}".`,
					),
					a.reportEvent(
						e.requestId,
						w.result.suggestionId,
						Date.now(),
						"error-response-not-line-aligned",
						"unknown",
					),
					Q.relPath !== e.pathName?.relPath)
				)
					continue
				a.reportEvent(
					e.requestId,
					w.result.suggestionId,
					Date.now(),
					"error-response-not-line-aligned-for-current-file",
					"unknown",
				),
					yield { status: He.invalidArgument }
				return
			}
			if (M.getText(q) !== w.result.existingCode) {
				if (
					(l.warn(`${B} Code in buffer doesn't match code in response.`),
					l.debug(`${B} Converting char range ${w.result.charStart}-${w.result.charEnd} to ${Y}-${j}.`),
					l.debug(`${B} Updated char range to ${ne?.start}-${ne?.stop}.`),
					l.debug(`${B} Buffer code: "${M.getText(q)}", response code: "${w.result.existingCode}".`),
					a.reportEvent(
						e.requestId,
						w.result.suggestionId,
						Date.now(),
						"error-code-in-buffer-doesnt-match-code-in-response",
						"unknown",
					),
					Q.relPath !== e.pathName?.relPath)
				)
					continue
				a.reportEvent(
					e.requestId,
					w.result.suggestionId,
					Date.now(),
					"error-code-in-buffer-doesnt-match-code-in-response-for-current-file",
					"unknown",
				),
					yield { status: He.invalidArgument }
				return
			}
			let Qe = new Na(
				e.requestId,
				e.mode,
				e.scope,
				{ ...w.result, charStart: ne.start, charEnd: ne.stop },
				Q,
				$u(q),
				M.uri.scheme,
			)
			l.debug(`${B} Returning ${Qe.changeType} suggestion for ${Q.relPath}@${Qe.lineRange.toString()}.`),
				yield { status: He.ok, suggestion: Qe }
		}
		l.debug(`[${e.requestId}] Request completed.`)
	} catch (b) {
		if (kr.isAPIErrorWithStatus(b, He.cancelled)) {
			l.debug(`[${e.requestId}] Cancelled by the server.`), yield { status: He.cancelled }
			return
		}
		l.warn(`[${e.requestId}] Next edit failed: ${b}.`),
			a.reportEvent(e.requestId, void 0, Date.now(), "error-api-error", "unknown"),
			yield { status: He.unknown }
		return
	} finally {
		v.dispose()
	}
}