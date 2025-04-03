
var E1 = class {
	constructor(t, r, n) {
		this._extension = t
		this._configListener = r
		this._metricsReporter = n
		this.generateCompletion = kxe(this.generateCompletion.bind(this), (i) => {
			this._metricsReporter.report({
				client_metric: "generate_completion_latency",
				value: i,
			})
		})
	}
	_logger = X("CompletionsModel")
	_completionSerial = 0
	async generateCompletion(t, r, n) {
		let i = this._extension.workspaceManager
		if (i === void 0) return
		let s = i.completionServer,
			o = s.createRequestId(),
			a = i.safeResolvePathName(t.uri)
		if (a === void 0) return
		let [l, c] = [a.rootPath, a.relPath],
			u = t.offsetAt(r),
			[f, p, g, m, y] = this._extractPrefixAndSuffix(t, u)
		u += y
		let C = { prefixBegin: g, cursorPosition: u, suffixEnd: m },
			b = (await this._requestCompletion(i, s, o, t, f, p, C, a, n)).completionItems
		if (b.length === 0)
			return {
				completions: [],
				document: t,
				requestId: o,
				repoRoot: l,
				pathName: c,
				prefix: f,
				suffix: p,
				occuredAt: new Date(),
				isReused: !1,
			}
		b.length > 1 && this._logger.warn("Multiple completions not supported, ignoring all but the first")
		let w = [],
			M = b[0]
		return (
			M.skippedSuffix.includes(`
`) &&
				(this._logger.debug("Skipped suffix spans multiple lines, dropping it"),
				(M.skippedSuffix = ""),
				(M.suffixReplacementText = "")),
			w.push(
				new ff(M.text, M.suffixReplacementText, M.skippedSuffix, {
					startOffset: t.offsetAt(r),
					endOffset: t.offsetAt(r),
				}),
			),
			this._logger.debug(`Returning ${w.length} completion(s)`),
			{
				occuredAt: new Date(),
				completions: w,
				document: t,
				requestId: o,
				repoRoot: l,
				pathName: c,
				prefix: f,
				suffix: p,
				isReused: !1,
			}
		)
	}
	async _requestCompletion(t, r, n, i, s, o, a, l, c) {
		let u = i.languageId
		if (this._configListener.config.completions.disableCompletionsByLanguage.has(u))
			throw new bh(`Language ${u} is disabled.`)
		let p = this._completionSerial++
		this._logger.debug(`Requesting new completion - #${p} submitted; requestId: ${n}`)
		let g = t.translateRange(l, a.prefixBegin, a.suffixEnd),
			m =
				g === void 0
					? a
					: {
							prefixBegin: g.beginOffset,
							cursorPosition: a.cursorPosition,
							suffixEnd: g.endOffset,
						},
			y = t.getContext(),
			C = y.blobs,
			v = this._getRecentChanges(y),
			w = t.getEnableCompletionFileEditEvents() ? t.getFileEditEvents() : void 0
		try {
			let B = await r.complete(n, s, o, l.relPath, g?.blobName, m, u, C, v, w, void 0, void 0, c)
			return (
				B.unknownBlobNames.length > 0 && t.handleUnknownBlobs(y, B.unknownBlobNames),
				B.checkpointNotFound && t.handleUnknownCheckpoint(n, C.checkpointId),
				G0t(B.completionItems, o, this._logger),
				this._extension.updateModelInfo(B),
				(B.completionItems = B.completionItems.filter((M) => (M.text + M.suffixReplacementText).length > 0)),
				B
			)
		} catch (B) {
			if (kr.isAPIErrorWithStatus(B, He.cancelled))
				throw (
					(this._logger.debug(`Completion #${p} cancelled in back end; requestId ${n}`),
					new bh("Cancelled in back end"))
				)
			if (kr.isRetriableAPIError(B))
				throw (
					(this._logger.debug(`Completion #${p} retriable error on back end; requestId ${n}`),
					new bh("Retriable error on back end"))
				)
			let M = Ye(B)
			throw (this._logger.warn(`Completion #${p} failed: ${M}; requestId ${n}`), B)
		}
	}
	_extractPrefixAndSuffix(t, r) {
		let n = this._extension.modelInfo,
			i = n.suggestedPrefixCharCount,
			s = n.suggestedSuffixCharCount,
			[o, a] = Dbe(t)
		o !== void 0 && (r += a)
		let l = Math.max(0, r - i),
			c = r + s
		if (o !== void 0) {
			let b = o.slice(l, r),
				w = o.slice(r, c)
			return [b, w, l, r + w.length, a]
		}
		let u = t.positionAt(l),
			f = t.positionAt(r),
			p = t.positionAt(r),
			g = t.positionAt(c),
			m = new ZG.Range(u, f),
			y = new ZG.Range(p, g),
			C = t.getText(m),
			v = t.getText(y)
		return [C, v, l, r + v.length, 0]
	}
	_getRecentChanges(t) {
		let r = t.recentChunks,
			n = t.lastChatResponse
		if (n !== void 0) {
			let i = {
					seq: n.seq,
					uploaded: !1,
					repoRoot: "",
					pathName: "",
					blobName: "",
					text: n.text,
					origStart: 0,
					origLength: 0,
					expectedBlobName: "",
				},
				s = r.findIndex((o) => o.seq < i.seq)
			s < 0 && (s = r.length), (r = r.slice(0, s).concat([i]).concat(r.slice(s)))
		}
		return By(r)
	}
}