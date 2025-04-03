
var nk = class extends Error {
		constructor(t, r) {
			super(`Conversion failure: ${t}. Response = ${r}`)
		}
	},
	nW = class e {
		constructor(t, r, n, i, s) {
			this._configListener = t
			this._auth = r
			this.sessionId = n
			this._userAgent = i
			this._fetchFunction = s
		}
		static defaultRequestTimeoutMs = 3e4
		_sequenceId = new iW()
		_logger = X("AugmentExtension")
		getSessionId() {
			return this.sessionId
		}
		createRequestId() {
			return Eh()
		}
		async callApi(t, r, n, i, s, o, a, l, c, u) {
			let f = u ?? r.apiToken,
				p = !1
			if (this._auth.useOAuth && !u) {
				let Q = await this._auth.getSession()
				Q && ((f = Q.accessToken), (p = !0), o || (o = Q.tenantURL))
			} else o || (o = r.completionURL)
			if (!o) throw new Error("Please configure Augment API URL")
			let g
			try {
				g = new URL(n, o)
			} catch (Q) {
				throw (this._logger.error("Augment API URL is invalid:", Q), new Yp())
			}
			if (!g.protocol.startsWith("http"))
				throw new Error("Augment API URL must start with 'http://' or 'https://'")
			let m = JSON.stringify(i, (Q, O) => (O === void 0 ? null : O)),
				y = a ?? e.defaultRequestTimeoutMs,
				C = AbortSignal.timeout(y),
				v = "POST",
				b,
				w,
				B
			try {
				let Q = {
					"Content-Type": "application/json",
					"User-Agent": this._userAgent,
					"x-request-id": `${t}`,
					"x-request-session-id": `${this.sessionId}`,
					"x-api-version": "2",
				}
				f && (Q.Authorization = `Bearer ${f}`),
					(w = Date.now()),
					(b = await yx(
						this._fetchFunction(g.toString(), {
							method: v,
							headers: Q,
							body: m,
							signal: PAe([C].concat(c ? [c] : [])),
						}),
						y,
					)),
					(B = Date.now())
			} catch (Q) {
				throw Q instanceof Error
					? (this._logger.error(`API request ${t} to ${g.toString()} failed: ${Ye(Q, !0)}`),
						kr.transientIssue(Q.message))
					: (this._logger.debug(`API request ${t} to ${g.toString()} failed`), Q)
			}
			if ((l && ((l.rpcStart = w), (l.rpcEnd = B)), !b.ok))
				throw b.status === 499
					? kr.fromResponse(b)
					: (b.status === 401 && p && this._auth.removeSession(),
						b.status === 400 &&
							r.enableDebugFeatures &&
							this._logger.error(`API request ${t} to ${g.toString()} failed: ${await b.text()}`),
						this._logger.error(`API request ${t} to ${g.toString()} response ${b.status}: ${b.statusText}`),
						kr.fromResponse(b).status === He.augmentTooLarge &&
							this._logger.debug(`object size is ${Ay(i)} `),
						kr.fromResponse(b))
			let M
			try {
				if (b.headers.get("content-length") === "0") return
				M = await b.json()
			} catch (Q) {
				throw (
					(this._logger.error(
						`API request ${t} to ${g.toString()} failed to convert response to json: ${Q.message}`,
					),
					Q)
				)
			}
			try {
				return s ? s(M) : M
			} catch (Q) {
				throw new nk(Ye(Q), JSON.stringify(M))
			}
		}
		/**
		 * Make a request to the API, following redirects and handling errors.
		 * @param {string} t - method (e.g. 'GET', 'POST')
		 * @param {string} r - API endpoint (e.g. '/api/v2/complete')
		 * @param {RequestInit} [i] - request options
		 * @param {(response: Response) => T} [s] - response transformer
		 * @param {string} [o] - base URL (if not set, use value from config)
		 * @param {boolean} [a] - log request and response bodies
		 * @param {import('./logger').Logger} [l] - logger (if not set, use default logger)
		 */
		async callApiStream(t, r, n, i, s = (c) => c, o, a, l) {
			let c = r.apiToken
			if (this._auth.useOAuth) {
				let w = await this._auth.getSession()
				w && ((c = w.accessToken), o || (o = w.tenantURL))
			} else o || (o = r.completionURL)
			if (!o) throw new Error("Please configure Augment API URL")
			let u
			try {
				u = new URL(n, o)
			} catch (w) {
				throw (this._logger.error("Augment API URL is invalid:", w), new Yp())
			}
			if (!u.protocol.startsWith("http"))
				throw new Error("Augment API URL must start with 'http://' or 'https://'")
			let f = JSON.stringify(i, (w, B) => (B === void 0 ? null : B)),
				p = a ?? e.defaultRequestTimeoutMs,
				g = AbortSignal.timeout(p),
				m = "POST",
				y
			try {
				let w = {
					"Content-Type": "application/json",
					"User-Agent": this._userAgent,
					"x-request-id": `${t}`,
					"x-request-session-id": `${l ?? this.sessionId}`,
				}
				c && (w.Authorization = `Bearer ${c}`),
					(y = await yx(
						this._fetchFunction(u.toString(), {
							method: m,
							headers: w,
							body: f,
							signal: g,
						}),
						p,
					))
			} catch (w) {
				throw w instanceof Error
					? (this._logger.error(`API request ${t} to ${u.toString()} failed: ${Ye(w, !0)}`),
						w.stack && this._logger.error(w.stack),
						kr.transientIssue(w.message))
					: w
			}
			if (!y.ok)
				throw y.status === 499
					? kr.fromResponse(y)
					: (y.status === 401 && this._auth.removeSession(),
						y.status === 400 &&
							r.enableDebugFeatures &&
							this._logger.error(`API request ${t} to ${u.toString()} failed: ${await y.text()}`),
						this._logger.error(`API request ${t} to ${u.toString()} response ${y.status}: ${y.statusText}`),
						kr.fromResponse(y).status === He.augmentTooLarge &&
							this._logger.debug(`object size is ${i ? Ay(i) : 0} `),
						kr.fromResponse(y))
			let C = y.body.getReader(),
				v = this._logger
			async function* b(w) {
				let B = new TextDecoder(),
					M = ""
				for (;;) {
					let { value: Q, done: O } = await w.read(new Uint8Array())
					if (O) return
					for (
						M += B.decode(Q, { stream: !0 });
						M.includes(`
`);

					) {
						let Y = M.indexOf(`
`),
							j = M.substring(0, Y)
						M = M.substring(Y + 1)
						try {
							let ne = JSON.parse(j)
							yield s(ne)
						} catch (ne) {
							v.error(`JSON parse failed for ${j}: ${Ye(ne)}`)
						}
					}
				}
			}
			return b(C)
		}
		_toCompletionItem(t) {
			if (typeof t.text != "string") throw new Error(`Completion item text is not a string: ${JSON.stringify(t)}`)
			if (t.skipped_suffix !== void 0 && typeof t.skipped_suffix != "string")
				throw new Error(`Completion item skipped suffix is not a string: ${JSON.stringify(t)}`)
			if (t.suffix_replacement_text !== void 0 && typeof t.suffix_replacement_text != "string")
				throw new Error(`Completion item suffix replacement text is not a string: ${JSON.stringify(t)}`)
			return {
				text: t.text,
				suffixReplacementText: t.suffix_replacement_text ?? "",
				skippedSuffix: t.skipped_suffix ?? "",
				filterScore: t.filter_score ?? void 0,
			}
		}
		_extractCompletions(t) {
			return Array.isArray(t.completion_items)
				? t.completion_items.map((r) => this._toCompletionItem(r))
				: Array.isArray(t.completions)
					? ml("BackCompletionResult", "completions", t.completions).map((n) => ({
							text: n,
							suffixReplacementText: "",
							skippedSuffix: "",
						}))
					: [
							{
								text: mi("BackCompletionResult", "text", t.text),
								suffixReplacementText: "",
								skippedSuffix: "",
							},
						]
		}
		toCompleteResult(t) {
			let r = this._extractCompletions(t),
				n = ml(
					"BackCompletionResult",
					"unknown_blob_names/unknown_memory_names",
					t.unknown_blob_names ?? t.unknown_memory_names,
				),
				i =
					t.checkpoint_not_found === void 0
						? !1
						: wu("BackCompletionResult", "checkpoint_not_found", t.checkpoint_not_found, !1)
			return {
				completionItems: r,
				unknownBlobNames: n,
				checkpointNotFound: i,
				suggestedPrefixCharCount: t.suggested_prefix_char_count,
				suggestedSuffixCharCount: t.suggested_suffix_char_count,
				completionTimeoutMs: t.completion_timeout_ms,
			}
		}
		toCheckpointBlobsResult(t) {
			return {
				newCheckpointId: mi("BackCheckpointBlobsResult", "new_checkpoint_id", t.new_checkpoint_id),
			}
		}
		async complete(t, r, n, i, s, o, a, l, c, u, f, p, g) {
			let m = this._configListener.config,
				y = { recent_changes: c },
				C = {
					model: m.modelName,
					prompt: r,
					suffix: n,
					path: i,
					blob_name: s,
					prefix_begin: o?.prefixBegin,
					cursor_position: o?.cursorPosition,
					suffix_end: o?.suffixEnd,
					lang: a,
					blobs: Ec(l),
					recency_info: y,
					probe_only: p,
					sequence_id: this._sequenceId.next(),
					filter_threshold: m.completions.filterThreshold,
					edit_events: this.toFileDiffsPayload(u ?? []),
				}
			return await this.callApi(t, m, "completion", C, (v) => this.toCompleteResult(v), void 0, f, g)
		}
		async checkpointBlobs(t) {
			let r = this.createRequestId(),
				n = this._configListener.config,
				i = { blobs: Ec(t) },
				s = await this.callApi(r, n, "checkpoint-blobs", i, (o) => this.toCheckpointBlobsResult(o))
			for (let o of this.getUniqueExtraURLs())
				(await this.callApi(r, n, "checkpoint-blobs", i, (l) => this.toCheckpointBlobsResult(l), o))
					.newCheckpointId !== s.newCheckpointId &&
					this._logger.error(`Checkpoint blobs API returned different checkpoint IDs for ${o}`)
			return s
		}
		convertToCodeEditResult(t) {
			let r =
					t.unknown_blob_names === void 0
						? []
						: ml("BackCodeEditResult", "unknown_blob_names", t.unknown_blob_names),
				n =
					t.checkpoint_not_found === void 0
						? !1
						: wu("BackCodeEditResult", "checkpoint_not_found", t.checkpoint_not_found, !1)
			return {
				unknownBlobNames: r,
				checkpointNotFound: n,
				modifiedCode: t.text,
			}
		}
		async editCode(t, r, n, i, s, o, a, l, c, u, f) {
			let p = this._configListener.config,
				m = {
					model: p.codeInstruction.model,
					instruction: r,
					prefix: i,
					selected_text: n,
					suffix: s,
					blob_name: a,
					prefix_begin: l,
					suffix_end: c,
					lang: u,
					path: o,
					blobs: Ec(f),
					sequence_id: this._sequenceId.next(),
				}
			return await this.callApi(t, p, "edit", m, (y) => this.convertToCodeEditResult(y), void 0, 12e4)
		}
		toChatResult(t) {
			let r = mi("BackChatResult", "text", t.text),
				n =
					t.unknown_blob_names === void 0
						? []
						: ml("BackChatResult", "unknown_blob_names", t.unknown_blob_names),
				i =
					t.checkpoint_not_found === void 0
						? !1
						: wu("BackChatResult", "checkpoint_not_found", t.checkpoint_not_found, !1),
				s =
					t.workspace_file_chunks === void 0
						? []
						: t.workspace_file_chunks.map((a) => ({
								charStart: Vi("BackWorkspaceFileChunk", "char_start", a.char_start),
								charEnd: Vi("BackWorkspaceFileChunk", "char_end", a.char_end),
								blobName: mi("BackWorkspaceFileChunk", "blob_name", a.blob_name),
							})),
				o = t.nodes
			return {
				text: r,
				unknownBlobNames: n,
				checkpointNotFound: i,
				workspaceFileChunks: s,
				nodes: o,
			}
		}
		async chat(t, r, n, i, s, o, a, l, c, u, f, p, g, m, y) {
			let C = this._configListener.config,
				v = {
					model: a ?? C.chat.model,
					path: m,
					prefix: p,
					selected_code: f,
					suffix: g,
					message: r,
					chat_history: n,
					lang: y,
					blobs: Ec(i),
					user_guided_blobs: s,
					external_source_ids: o,
					enable_preference_collection: C.preferenceCollection.enable,
					context_code_exchange_request_id: u,
					vcs_change: this.toVCSChangePayload(l),
					recency_info_recent_changes: c,
					feature_detection_flags: { support_raw_output: !0 },
				}
			return await this.callApi(t, C, "chat", v, (b) => this.toChatResult(b), C.chat.url, 3e5)
		}
		async chatStream(t, r, n, i, s, o, a, l, c, u, f, p, g, m, y, C, v, b, w, B, M, Q, O) {
			let Y = this._configListener.config,
				j = {
					model: a ?? Y.chat.model,
					path: m,
					prefix: p,
					selected_code: f,
					suffix: g,
					message: r,
					chat_history: n,
					lang: y,
					blobs: Ec(i),
					user_guided_blobs: s,
					context_code_exchange_request_id: u,
					vcs_change: this.toVCSChangePayload(l),
					recency_info_recent_changes: c,
					external_source_ids: o,
					disable_auto_external_sources: v,
					user_guidelines: b,
					workspace_guidelines: w,
					feature_detection_flags: { support_raw_output: !0 },
					tool_definitions: B ?? [],
					nodes: M ?? [],
					mode: Q ?? Mn.chat,
					agent_memories: O,
				}
			return await xi(
				() => this.callApiStream(t, Y, "chat-stream", j, this.toChatResult.bind(this), Y.chat.url, 3e5, C),
				this._logger,
				{ initialMS: 250, mult: 2, maxMS: 5e3, maxTries: 5, maxTotalMs: 5e3 },
			)
		}
		toChatInstructionStreamResult(t) {
			let r =
					t.unknown_blob_names === void 0
						? []
						: ml("BackChatInstructionStreamResult", "unknown_blob_names", t.unknown_blob_names),
				n =
					t.checkpoint_not_found === void 0
						? !1
						: wu("BackChatInstructionStreamResult", "checkpoint_not_found", t.checkpoint_not_found, !1)
			return {
				text: t.text,
				unknownBlobNames: r,
				checkpointNotFound: n,
				replacementText: t.replacement_text,
				replacementOldText: t.replacement_old_text,
				replacementStartLine: t.replacement_start_line,
				replacementEndLine: t.replacement_end_line,
			}
		}
		async chatInstructionStream(
			t,
			r,
			n,
			i,
			s = "",
			o = "",
			a = "",
			l = "",
			c = "",
			u = void 0,
			f = void 0,
			p = "",
			g,
			m,
			y,
		) {
			let C = this._configListener.config,
				v = r.length === 0,
				b,
				w
			v
				? ((b = C.smartPaste.url ?? C.chat.url), (w = C.smartPaste.model))
				: ((b = C.chat.url), (w = C.instructions.model))
			let B = {
				model: w,
				prefix: o,
				selected_text: s,
				suffix: a,
				path: l,
				instruction: r,
				lang: p,
				blob_name: c,
				prefix_begin: u,
				suffix_end: f,
				blobs: Ec(n),
				chat_history: i,
				context_code_exchange_request_id: y,
				user_guidelines: g,
				workspace_guidelines: m,
			}
			return await this.callApiStream(
				t,
				C,
				"instruction-stream",
				B,
				this.toChatInstructionStreamResult.bind(this),
				b,
				12e4,
			)
		}
		_smartPasteQueue = new rk(this._processSingleSmartPasteRequest.bind(this))
		async smartPasteStream(
			t,
			r,
			n,
			i,
			s = "",
			o = "",
			a = "",
			l = "",
			c = "",
			u = void 0,
			f = void 0,
			p = "",
			g = "",
			m = "",
			y = "",
			C,
		) {
			let v = {
				requestId: t,
				instruction: r,
				blobs: n,
				chatHistory: i,
				selectedText: s,
				prefix: o,
				suffix: a,
				pathName: l,
				blobName: c,
				prefixBegin: u,
				suffixEnd: f,
				language: p,
				codeBlock: g,
				targetFilePath: m,
				targetFileContent: y,
				contextCodeExchangeRequestId: C,
			}
			return this._smartPasteQueue.insertAndKick(v)
		}
		async _processSingleSmartPasteRequest(t) {
			if (t === void 0) return
			if (t.requestServicedSignal !== void 0) return await t.requestServicedSignal
			let r = this._configListener.config,
				n = t.instruction.length === 0,
				i,
				s
			n ? ((i = r.smartPaste.url ?? r.chat.url), (s = r.smartPaste.model)) : (i = r.chat.url)
			let o = {
					model: s,
					prefix: t.prefix,
					selected_text: t.selectedText,
					suffix: t.suffix,
					path: t.pathName,
					instruction: t.instruction,
					lang: t.language,
					blob_name: t.blobName,
					prefix_begin: t.prefixBegin,
					suffix_end: t.suffixEnd,
					blobs: Ec(t.blobs),
					chat_history: t.chatHistory,
					code_block: t.codeBlock,
					target_file_path: t.targetFilePath,
					target_file_content: t.targetFileContent,
					context_code_exchange_request_id: t.contextCodeExchangeRequestId,
				},
				a
			return (
				(t.requestServicedSignal = new Promise((c) => {
					a = c
				})),
				this._smartPasteQueue.insertAndKick(t),
				async function* () {
					try {
						yield* await this.callApiStream(
							t.requestId,
							r,
							"smart-paste-stream",
							o,
							this.toChatInstructionStreamResult.bind(this),
							i,
							12e4,
						)
					} finally {
						a()
					}
				}.bind(this)()
			)
		}
		toGenerateCommitMessageResult(t) {
			return { text: t.text }
		}
		async generateCommitMessageStream(t, r) {
			let n = this._configListener.config,
				i = {
					changed_file_stats: r.changedFileStats,
					diff: r.diff,
					relevant_commit_messages: r.generatedCommitMessageSubrequest.relevant_commit_messages,
					example_commit_messages: r.generatedCommitMessageSubrequest.example_commit_messages,
				}
			return await this.callApiStream(
				t,
				n,
				"generate-commit-message-stream",
				i,
				this.toGenerateCommitMessageResult.bind(this),
				void 0,
				12e4,
			)
		}
		async createRemoteAgent(t, r, n, i) {
			let s = this.createRequestId(),
				o = this._configListener.config,
				a = {
					workspace_setup: t,
					initial_request_details: {
						request_nodes: r.request_nodes,
						user_guidelines: r.user_guidelines ?? o.chat.userGuidelines,
						workspace_guidelines: r.workspace_guidelines ?? "",
						agent_memories: r.agent_memories ?? "",
					},
					model: n ?? o.modelName,
					setup_script: i,
				}
			if (this._auth.useOAuth) {
				let l = await this._auth.getSession()
				l && (a.token = l.accessToken)
			}
			return (
				a.token || (a.token = o.remoteAgent.apiToken),
				console.log("Calling /remote-agents/create with payload: ", a),
				await this.callApi(
					s,
					o,
					"remote-agents/create",
					a,
					void 0,
					o.remoteAgent.url,
					void 0,
					void 0,
					void 0,
					o.remoteAgent.apiToken,
				)
			)
		}
		async remoteAgentChat(t, r) {
			let n = this.createRequestId(),
				i = this._configListener.config,
				s = {
					remote_agent_id: t,
					request_details: {
						request_nodes: r.request_nodes,
						user_guidelines: r.user_guidelines ?? i.chat.userGuidelines,
						workspace_guidelines: r.workspace_guidelines ?? "",
						agent_memories: r.agent_memories ?? "",
					},
				},
				o = await this.callApi(
					n,
					i,
					"remote-agents/chat",
					s,
					void 0,
					i.remoteAgent.url,
					void 0,
					void 0,
					void 0,
					i.remoteAgent.apiToken,
				)
			return { remoteAgentId: o.remote_agent_id, nodes: o.nodes }
		}
		async deleteRemoteAgent(t) {
			let r = this.createRequestId(),
				n = this._configListener.config,
				i = { remote_agent_id: t }
			return await this.callApi(
				r,
				n,
				"remote-agents/delete",
				i,
				void 0,
				n.remoteAgent.url,
				void 0,
				void 0,
				void 0,
				n.remoteAgent.apiToken,
			)
		}
		async interruptRemoteAgent(t) {
			let r = this.createRequestId(),
				n = this._configListener.config,
				i = { remote_agent_id: t }
			return await this.callApi(
				r,
				n,
				"remote-agents/interrupt",
				i,
				void 0,
				n.remoteAgent.url,
				void 0,
				void 0,
				void 0,
				n.remoteAgent.apiToken,
			)
		}
		async listRemoteAgents() {
			let t = this.createRequestId(),
				r = this._configListener.config
			return await this.callApi(
				t,
				r,
				"remote-agents/list",
				{},
				void 0,
				r.remoteAgent.url,
				void 0,
				void 0,
				void 0,
				r.remoteAgent.apiToken,
			)
		}
		async getRemoteAgentChatHistory(t) {
			let r = this.createRequestId(),
				n = this._configListener.config,
				i = { remote_agent_id: t }
			return await this.callApi(
				r,
				n,
				"remote-agents/get-chat-history",
				i,
				void 0,
				n.remoteAgent.url,
				void 0,
				void 0,
				void 0,
				n.remoteAgent.apiToken,
			)
		}
		toAutofixCommandPayload(t) {
			return { input: t.input, output: t.output, exit_code: t.exitCode }
		}
		toVCSChangePayload(t) {
			return {
				working_directory_changes: t.workingDirectory.map((r) => ({
					before_path: r.beforePath,
					after_path: r.afterPath,
					change_type: r.changeType,
					head_blob_name: r.headBlobName,
					indexed_blob_name: r.indexedBlobName,
					current_blob_name: r.currentBlobName,
				})),
			}
		}
		toBackTextReplacement(t) {
			return {
				description: t.description,
				path: t.path,
				text: t.text,
				old_text: t.oldText,
				start_line: t.startLine,
				end_line: t.endLine,
				sequence_id: t.sequenceId,
				old_blob_name: t.oldBlobName,
			}
		}
		toFileDiffsPayload(t) {
			return t.map((r) => ({
				path: r.path,
				before_blob_name: r.beforeBlobName,
				after_blob_name: r.afterBlobName,
				edits: r.edits.map((n) => ({
					before_start: n.beforeStart,
					after_start: n.afterStart,
					before_text: n.beforeText,
					after_text: n.afterText,
				})),
			}))
		}
		toFileCharRangePayload(t) {
			return t
				.filter((r) => r.charStart !== void 0 && r.charStop !== void 0)
				.map((r) => ({
					path: r.path,
					char_start: r.charStart,
					char_end: r.charStop,
				}))
		}
		toNextEditLocationResult(t) {
			py("BackNextEditLocationResult", "candidate_locations", t.candidate_locations)
			let r =
					t.unknown_blob_names === void 0
						? []
						: ml("BackNextEditLocationResult", "unknown_blob_names", t.unknown_blob_names),
				n =
					t.checkpoint_not_found === void 0
						? !1
						: wu("BackNextEditResult", "checkpoint_not_found", t.checkpoint_not_found, !1),
				i =
					t.critical_errors === void 0 || t.critical_errors === null
						? []
						: ml("BackNextEditResult", "critical_errors", t.critical_errors),
				s = []
			for (let o of t.candidate_locations) {
				let a = {
						start: Vi("BackLineRange", "start", o.item.range.start),
						stop: Vi("BackLineRange", "stop", o.item.range.stop),
					},
					c = {
						item: { path: mi("BackLocation", "path", o.item.path), range: a },
						score: Vi("BackScored", "score", o.score),
						debugInfo: o.debug_info,
					}
				s.push(c)
			}
			return {
				candidateLocations: s,
				unknownBlobNames: r,
				checkpointNotFound: n,
				criticalErrors: i,
			}
		}
		async nextEditLocation(t, r, n, i, s, o, a, l, c, u) {
			let f = this._configListener.config,
				p = {
					instruction: r,
					path: n,
					vcs_change: this.toVCSChangePayload(i),
					edit_events: this.toFileDiffsPayload(s),
					blobs: Ec(o),
					recent_changes: a,
					diagnostics: l,
					num_results: c,
					is_single_file: u,
				}
			return await this.callApi(
				t,
				f,
				"next_edit_loc",
				p,
				(g) => this.toNextEditLocationResult(g),
				f.nextEdit.locationUrl,
				12e4,
			)
		}
		convertToAutofixCheckResponse(t) {
			return {
				containsFailure: wu("BackAutofixCheckResponse", "contains_failure", t.contains_failure, !1),
				isCodeRelated: wu("BackAutofixCheckResponse", "is_code_related", t.is_code_related, !1),
			}
		}
		convertToAutofixPlanResponse(t) {
			return {
				unknownBlobNames: ml("BackAutofixPlanResponse", "unknown_blob_names", t.unknown_blob_names),
				checkpointNotFound: wu("BackAutofixPlanResponse", "checkpoint_not_found", t.checkpoint_not_found, !1),
				summary: t.summary,
				replacements: t.replacements.map((r) => ({
					description: r.description,
					path: r.path,
					text: r.text,
					oldText: r.old_text,
					startLine: r.start_line,
					endLine: r.end_line,
					sequenceId: r.sequence_id,
					oldBlobName: r.old_blob_name,
				})),
			}
		}
		convertToNextEditGenerationResult(t) {
			let r =
					t.unknown_blob_names === void 0
						? []
						: ml("BackNextEditGenerationResult", "unknown_blob_names", t.unknown_blob_names),
				n =
					t.checkpoint_not_found === void 0
						? !1
						: wu("BackNextEditResult", "checkpoint_not_found", t.checkpoint_not_found, !1)
			return {
				result: this.convertToNextEditResult(t.next_edit),
				unknownBlobNames: r,
				checkpointNotFound: n,
			}
		}
		convertToNextEditResult(t) {
			let r = mi("BackNextEditResult", "suggestion_id", t.suggestion_id),
				n = mi("BackNextEditResult", "path", t.path),
				i = mi("BackNextEditResult", "blob_name", t.blob_name),
				s = Vi("BackNextEditResult", "char_start", t.char_start),
				o = Vi("BackNextEditResult", "char_end", t.char_end),
				a = mi("BackNextEditResult", "existing_code", t.existing_code),
				l = mi("BackNextEditResult", "suggested_code", t.suggested_code),
				c =
					t.truncation_char === void 0 || t.truncation_char === null
						? void 0
						: Vi("BackNextEditResult", "truncation_char", t.truncation_char),
				u =
					t.change_description === void 0
						? ""
						: mi("BackNextEditResult", "change_description", t.change_description),
				f = t.diff_spans?.map((y) => ({
					original: {
						start: Vi("BackCharRange", "start", y.original.start),
						stop: Vi("BackCharRange", "stop", y.original.stop),
					},
					updated: {
						start: Vi("BackCharRange", "start", y.updated.start),
						stop: Vi("BackCharRange", "stop", y.updated.stop),
					},
				})),
				p = Vi("BackNextEditResult", "editing_score", t.editing_score),
				g = Vi("BackNextEditResult", "localization_score", t.localization_score),
				m =
					t.editing_score_threshold === void 0
						? 1
						: Vi("BackNextEditResult", "editing_score_threshold", t.editing_score_threshold)
			return {
				suggestionId: r,
				path: n,
				blobName: i,
				charStart: s,
				charEnd: o,
				existingCode: a,
				suggestedCode: l,
				truncationChar: c,
				changeDescription: u,
				diffSpans: f,
				editingScore: p,
				localizationScore: g,
				editingScoreThreshold: m,
			}
		}
		async nextEditStream(t) {
			let r = this._configListener.config,
				n = r.nextEdit.model,
				i = t.prefix ? yl(t.prefix) : void 0,
				s = {
					model: n,
					instruction: t.instruction ?? "",
					prefix: t.prefix,
					selected_text: t.selectedCode,
					suffix: t.suffix,
					selection_begin_char: i,
					selection_end_char:
						t.prefix !== void 0 && t.selectedCode !== void 0 ? i + yl(t.selectedCode) : void 0,
					blob_name: t.blobName,
					lang: t.language,
					path: t.pathName?.relPath,
					blobs: (t.blobs && Ec(t.blobs)) ?? {
						checkpoint_id: void 0,
						added_blobs: [],
						deleted_blobs: [],
					},
					recent_changes: t.recentChanges,
					diagnostics: t.diagnostics,
					vcs_change: this.toVCSChangePayload({
						workingDirectory: [],
						commits: [],
					}),
					edit_events: this.toFileDiffsPayload(t.fileEditEvents ?? []),
					blocked_locations: this.toFileCharRangePayload(t.blockedLocations ?? []),
					mode: t.mode,
					scope: t.scope,
					api_version: 2,
					sequence_id: this._sequenceId.next(),
					client_created_at: t.clientCreatedAt,
					unindexed_edit_events: this.toFileDiffsPayload(t.unindexedEditEvents),
					unindexed_edit_events_base_blob_names: t.unindexedEditEventsBaseBlobNames,
				}
			return await this.callApiStream(
				t.requestId,
				r,
				"next-edit-stream",
				s,
				this.convertToNextEditGenerationResult.bind(this),
				r.nextEdit.generationUrl,
				12e4,
			)
		}
		getUniqueExtraURLs() {
			let t = this._configListener.config,
				r = new Set()
			return (
				t.nextEdit.url && r.add(t.nextEdit.url),
				t.nextEdit.locationUrl && r.add(t.nextEdit.locationUrl),
				t.nextEdit.generationUrl && r.add(t.nextEdit.generationUrl),
				t.chat.url && r.add(t.chat.url),
				r
			)
		}
		toMemorizeResult(t) {
			return {
				blobName:
					t.blob_name !== void 0
						? mi("BackMemorizeResult", "blob_name", t.blob_name)
						: mi("BackMemorizeResult", "mem_object_name", t.mem_object_name),
			}
		}
		async memorize(t, r, n, i, s) {
			let o = this.createRequestId(),
				a = this._configListener.config,
				l = await this.callApi(
					o,
					a,
					"memorize",
					{
						model: a.modelName,
						path: t,
						t: r,
						blob_name: n,
						metadata: i,
						timeout_ms: s,
					},
					(c) => this.toMemorizeResult(c),
				)
			for (let c of this.getUniqueExtraURLs())
				await this.callApi(
					o,
					a,
					"memorize",
					{ model: a.modelName, path: t, t: r, blob_name: n, metadata: i },
					(u) => this.toMemorizeResult(u),
					c,
				)
			return l
		}
		toBatchUploadResult(t) {
			return { blobNames: t.blob_names }
		}
		async batchUpload(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			try {
				let i = await this.callApi(
					r,
					n,
					"batch-upload",
					{
						blobs: t.map((s) => ({
							blob_name: s.blobName,
							path: s.pathName,
							content: s.text,
						})),
					},
					this.toBatchUploadResult.bind(this),
				)
				for (let s of this.getUniqueExtraURLs())
					await this.callApi(
						r,
						n,
						"batch-upload",
						{
							blobs: t.map((o) => ({
								blob_name: o.blobName,
								path: o.pathName,
								content: o.text,
							})),
						},
						this.toBatchUploadResult.bind(this),
						s,
					)
				return i
			} catch (i) {
				if (!kr.isAPIErrorWithStatus(i, He.unimplemented)) throw i
				let s = []
				for (let o of t) {
					let a = await this.memorize(o.pathName, o.text, o.blobName, o.metadata)
					s.push(a.blobName)
				}
				return { blobNames: s }
			}
		}
		toFindMissingResult(t) {
			return {
				unknownBlobNames: ml("BackFindMissingResult", "unknown_memory_names", t.unknown_memory_names),
				nonindexedBlobNames: ml("BackFindMissingResult", "nonindexed_blob_names", t.nonindexed_blob_names),
			}
		}
		async findMissing(t) {
			let r = this._configListener.config,
				n = this.createRequestId(),
				i = r.modelName,
				s = [...t].sort(),
				o = await this.callApi(n, r, "find-missing", { model: i, mem_object_names: s }, (a) =>
					this.toFindMissingResult(a),
				)
			for (let a of this.getUniqueExtraURLs()) {
				let l = await this.callApi(
					n,
					r,
					"find-missing",
					{ model: i, mem_object_names: s },
					(c) => this.toFindMissingResult(c),
					a,
				)
				;(o.unknownBlobNames = o.unknownBlobNames.concat(l.unknownBlobNames)),
					(o.nonindexedBlobNames = o.nonindexedBlobNames.concat(l.nonindexedBlobNames))
			}
			return o
		}
		async resolveCompletions(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(r, n, "resolve-completions", {
				client_name: "vscode-extension",
				resolutions: t,
			})
		}
		async logCodeEditResolution(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(r, n, "resolve-edit", {
				client_name: "vscode-extension",
				...t,
			})
		}
		async logSmartPasteResolution(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(r, n, "resolve-smart-paste", {
				client_name: "vscode-extension",
				...t,
			})
		}
		async logInstructionResolution(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(r, n, "resolve-instruction", {
				client_name: "vscode-extension",
				...t,
			})
		}
		async resolveNextEdits(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(
				r,
				n,
				"resolve-next-edit",
				{ client_name: "vscode-extension", resolutions: t },
				void 0,
				n.nextEdit.url,
			)
		}
		async logNextEditSessionEvent(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(
				r,
				n,
				"record-session-events",
				{
					client_name: "vscode-extension",
					events: t.map((i) => ({
						time: new Date(i.event_time_sec * 1e3 + i.event_time_nsec / 1e6).toISOString(),
						event: {
							next_edit_session_event: { ...i, user_agent: this._userAgent },
						},
					})),
				},
				void 0,
				n.nextEdit.url,
			)
		}
		async logOnboardingSessionEvent(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(
				r,
				n,
				"record-session-events",
				{
					client_name: "vscode-extension",
					events: t.map((i) => ({
						time: new Date(i.event_time_sec * 1e3 + i.event_time_nsec / 1e6).toISOString(),
						event: {
							onboarding_session_event: { ...i, user_agent: this._userAgent },
						},
					})),
				},
				void 0,
			)
		}
		async logAgentSessionEvent(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(
				r,
				n,
				"record-session-events",
				{
					client_name: "vscode-extension",
					events: t.map((i) => ({
						time: new Date(i.event_time_sec * 1e3 + i.event_time_nsec / 1e6).toISOString(),
						event: {
							agent_session_event: { ...i, user_agent: this._userAgent },
						},
					})),
				},
				void 0,
			)
		}
		async logAgentRequestEvent(t) {
			let r = new Map()
			for (let n of t) {
				let i = r.get(n.request_id) || []
				r.has(n.request_id) || r.set(n.request_id, i)
				let { request_id: s, ...o } = n
				i.push(o)
			}
			for (let [n, i] of r) {
				let s = this._configListener.config
				await this.callApi(
					n,
					s,
					"record-request-events",
					{
						events: i.map((o) => ({
							time: new Date(o.event_time_sec * 1e3 + o.event_time_nsec / 1e6).toISOString(),
							event: {
								agent_request_event: { ...o, user_agent: this._userAgent },
							},
						})),
					},
					void 0,
				)
			}
		}
		async logExtensionSessionEvent(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(
				r,
				n,
				"record-session-events",
				{
					client_name: "vscode-extension",
					events: t.map((i) => ({
						time: i.time_iso,
						event: {
							extension_session_event: { ...i, user_agent: this._userAgent },
						},
					})),
				},
				void 0,
			)
		}
		async logToolUseRequestEvent(t) {
			let r = new Map()
			for (let n of t) {
				let i = r.get(n.requestId)
				i === void 0 ? r.set(n.requestId, [n]) : i.push(n)
			}
			for (let [n, i] of r) {
				let s = this._configListener.config
				await this.callApi(
					n,
					s,
					"record-request-events",
					{
						events: i.map((o) => {
							let a = {
								tool_name: o.toolName,
								tool_use_id: o.toolUseId,
								tool_output_is_error: o.toolOutputIsError,
								tool_run_duration_ms: o.toolRunDurationMs,
								tool_input: JSON.stringify(o.toolInput),
								is_mcp_tool: o.isMcpTool,
								conversation_id: o.conversationId,
								chat_history_length: o.chatHistoryLength,
								tool_request_id: o.toolRequestId,
							}
							return {
								time: new Date(o.eventTimeSec * 1e3 + o.eventTimeNsec / 1e6).toISOString(),
								event: { tool_use_data: a },
							}
						}),
					},
					void 0,
				)
			}
		}
		async recordPreferenceSample(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(r, n, "record-preference-sample", {
				client_name: "vscode-extension",
				...t,
			})
		}
		toModel(t) {
			let r =
				t.completion_timeout_ms !== void 0
					? Vi("BackModelInfo", "completion_timeout_ms", t.completion_timeout_ms)
					: void 0
			return {
				name: mi("BackModelInfo", "name", t.name),
				suggestedPrefixCharCount: Vi(
					"BackModelInfo",
					"suggested_prefix_char_count",
					t.suggested_prefix_char_count,
				),
				suggestedSuffixCharCount: Vi(
					"BackModelInfo",
					"suggested_suffix_char_count",
					t.suggested_suffix_char_count,
				),
				completionTimeoutMs: r,
				internalName: t.internal_name && mi("BackModelInfo", "internal_name", t.internal_name),
			}
		}
		toLanguage(t) {
			let r = mi("BackLanguageInfo", "name", t.name),
				n = mi("BackLanguageInfo", "vscodeName", t.vscode_name)
			py("BackLanguageInfo", "extensions", t.extensions)
			let i = []
			for (let s of t.extensions) i.push(mi("BackLanguageInfo", "extensions", s))
			return { name: r, vscodeName: n, extensions: i }
		}
		toGetModelsResult(t) {
			let r = mi("BackGetModelsResult", "default_model", t.default_model)
			py("BackGetModelsResult", "models", t.models)
			let n = []
			for (let a of t.models) n.push(this.toModel(a))
			let i = Gp
			if (t.feature_flags !== void 0) {
				let a = t.feature_flags.git_diff_polling_freq_msec
				if (
					(a !== void 0 && a > 0 && ((i.gitDiff = !0), (i.gitDiffPollingFrequencyMSec = a)),
					t.feature_flags.small_sync_threshold !== void 0 &&
						(i.smallSyncThreshold = t.feature_flags.small_sync_threshold),
					t.feature_flags.big_sync_threshold !== void 0 &&
						(i.bigSyncThreshold = t.feature_flags.big_sync_threshold),
					t.feature_flags.enable_workspace_manager_ui_launch !== void 0 &&
						(i.enableWorkspaceManagerUi = t.feature_flags.enable_workspace_manager_ui_launch),
					t.feature_flags.enable_instructions !== void 0 &&
						(i.enableInstructions = t.feature_flags.enable_instructions),
					t.feature_flags.enable_smart_paste !== void 0 &&
						(i.enableSmartPaste = t.feature_flags.enable_smart_paste),
					t.feature_flags.enable_smart_paste_min_version !== void 0 &&
						(i.enableSmartPasteMinVersion = t.feature_flags.enable_smart_paste_min_version),
					t.feature_flags.enable_view_text_document !== void 0 &&
						(i.enableViewTextDocument = t.feature_flags.enable_view_text_document),
					t.feature_flags.bypass_language_filter !== void 0 &&
						(i.bypassLanguageFilter = t.feature_flags.bypass_language_filter),
					t.feature_flags.additional_chat_models !== void 0 &&
						(i.additionalChatModels = t.feature_flags.additional_chat_models),
					t.feature_flags.enable_hindsight !== void 0 &&
						(i.enableHindsight = t.feature_flags.enable_hindsight),
					t.feature_flags.max_upload_size_bytes !== void 0 &&
						(i.maxUploadSizeBytes = t.feature_flags.max_upload_size_bytes),
					t.feature_flags.vscode_next_edit_min_version !== void 0 &&
						(i.vscodeNextEditMinVersion = t.feature_flags.vscode_next_edit_min_version),
					t.feature_flags.vscode_next_edit_ux1_max_version !== void 0 &&
						(i.vscodeNextEditUx1MaxVersion = t.feature_flags.vscode_next_edit_ux1_max_version),
					t.feature_flags.vscode_next_edit_ux2_max_version !== void 0 &&
						(i.vscodeNextEditUx2MaxVersion = t.feature_flags.vscode_next_edit_ux2_max_version),
					t.feature_flags.vscode_flywheel_min_version !== void 0 &&
						(i.vscodeFlywheelMinVersion = t.feature_flags.vscode_flywheel_min_version),
					t.feature_flags.vscode_external_sources_in_chat_min_version !== void 0 &&
						(i.vscodeExternalSourcesInChatMinVersion =
							t.feature_flags.vscode_external_sources_in_chat_min_version),
					t.feature_flags.vscode_share_min_version !== void 0 &&
						(i.vscodeShareMinVersion = t.feature_flags.vscode_share_min_version),
					t.feature_flags.max_trackable_file_count !== void 0 &&
						(i.maxTrackableFileCount = t.feature_flags.max_trackable_file_count),
					t.feature_flags.max_trackable_file_count_without_permission !== void 0 &&
						(i.maxTrackableFileCountWithoutPermission =
							t.feature_flags.max_trackable_file_count_without_permission),
					t.feature_flags.min_uploaded_percentage_without_permission !== void 0 &&
						(i.minUploadedPercentageWithoutPermission =
							t.feature_flags.min_uploaded_percentage_without_permission),
					t.feature_flags.vscode_sources_min_version !== void 0 &&
						(i.vscodeSourcesMinVersion = t.feature_flags.vscode_sources_min_version),
					t.feature_flags.vscode_chat_hint_decoration_min_version !== void 0 &&
						(i.vscodeChatHintDecorationMinVersion =
							t.feature_flags.vscode_chat_hint_decoration_min_version),
					t.feature_flags.next_edit_debounce_ms !== void 0 &&
						(i.nextEditDebounceMs = t.feature_flags.next_edit_debounce_ms),
					t.feature_flags.enable_completion_file_edit_events !== void 0 &&
						(i.enableCompletionFileEditEvents = t.feature_flags.enable_completion_file_edit_events),
					t.feature_flags.vscode_enable_cpu_profile !== void 0 &&
						(i.vscodeEnableCpuProfile = t.feature_flags.vscode_enable_cpu_profile),
					t.feature_flags.verify_folder_is_source_repo !== void 0 &&
						(i.verifyFolderIsSourceRepo = t.feature_flags.verify_folder_is_source_repo),
					t.feature_flags.refuse_to_sync_home_directories !== void 0 &&
						(i.refuseToSyncHomeDirectories = t.feature_flags.refuse_to_sync_home_directories),
					t.feature_flags.enable_file_limits_for_syncing_permission !== void 0 &&
						(i.enableFileLimitsForSyncingPermission =
							t.feature_flags.enable_file_limits_for_syncing_permission),
					t.feature_flags.enable_chat_mermaid_diagrams !== void 0 &&
						(i.enableChatMermaidDiagrams = t.feature_flags.enable_chat_mermaid_diagrams),
					t.feature_flags.enable_summary_titles !== void 0 &&
						(i.enableSummaryTitles = t.feature_flags.enable_summary_titles),
					t.feature_flags.smart_paste_precompute_mode !== void 0 &&
						(i.smartPastePrecomputeMode = t.feature_flags.smart_paste_precompute_mode),
					t.feature_flags.vscode_new_threads_menu_min_version !== void 0 &&
						(i.vscodeNewThreadsMenuMinVersion = t.feature_flags.vscode_new_threads_menu_min_version),
					t.feature_flags.vscode_editable_history_min_version !== void 0 &&
						(i.vscodeEditableHistoryMinVersion = t.feature_flags.vscode_editable_history_min_version),
					t.feature_flags.vscode_enable_chat_mermaid_diagrams_min_version !== void 0 &&
						(i.vscodeEnableChatMermaidDiagramsMinVersion =
							t.feature_flags.vscode_enable_chat_mermaid_diagrams_min_version),
					t.feature_flags.enable_guidelines !== void 0 &&
						(i.enableGuidelines = t.feature_flags.enable_guidelines),
					t.feature_flags.vscode_use_checkpoint_manager_context_min_version !== void 0 &&
						(i.useCheckpointManagerContextMinVersion =
							t.feature_flags.vscode_use_checkpoint_manager_context_min_version),
					t.feature_flags.vscode_validate_checkpoint_manager_context !== void 0 &&
						(i.validateCheckpointManagerContext =
							t.feature_flags.vscode_validate_checkpoint_manager_context),
					t.feature_flags.vscode_design_system_rich_text_editor_min_version !== void 0 &&
						(i.vscodeDesignSystemRichTextEditorMinVersion =
							t.feature_flags.vscode_design_system_rich_text_editor_min_version),
					t.feature_flags.allow_client_feature_flag_overrides !== void 0 &&
						(i.allowClientFeatureFlagOverrides = t.feature_flags.allow_client_feature_flag_overrides),
					t.feature_flags.vscode_chat_with_tools_min_version !== void 0 &&
						(i.vscodeChatWithToolsMinVersion = t.feature_flags.vscode_chat_with_tools_min_version),
					t.feature_flags.vscode_agent_mode_min_version !== void 0 &&
						(i.vscodeAgentModeMinVersion = t.feature_flags.vscode_agent_mode_min_version),
					t.feature_flags.vscode_background_agents_min_version !== void 0 &&
						(i.vscodeBackgroundAgentsMinVersion = t.feature_flags.vscode_background_agents_min_version),
					t.feature_flags.vscode_agent_edit_tool !== void 0 &&
						(i.vscodeAgentEditTool = t.feature_flags.vscode_agent_edit_tool),
					t.feature_flags.memories_params !== void 0)
				)
					try {
						i.memoriesParams = JSON.parse(t.feature_flags.memories_params)
					} catch {
						this._logger.error('Parsing of "memories_params" failed.')
					}
				if (t.feature_flags.elo_model_configuration !== void 0)
					try {
						i.eloModelConfiguration = JSON.parse(t.feature_flags.elo_model_configuration)
					} catch {
						this._logger.error('Parsing of "elo_model_configuration" failed.')
					}
				t.feature_flags.client_truncate_chat_history !== void 0 &&
					(i.truncateChatHistory = t.feature_flags.client_truncate_chat_history),
					t.feature_flags.vscode_next_edit_bottom_panel_min_version !== void 0 &&
						(i.vscodeNextEditBottomPanelMinVersion =
							t.feature_flags.vscode_next_edit_bottom_panel_min_version),
					t.feature_flags.vscode_chat_multimodal_min_version !== void 0 &&
						(i.vscodeChatMultimodalMinVersion = t.feature_flags.vscode_chat_multimodal_min_version),
					t.feature_flags.workspace_guidelines_length_limit !== void 0 &&
						(i.workspaceGuidelinesLengthLimit = t.feature_flags.workspace_guidelines_length_limit),
					t.feature_flags.user_guidelines_length_limit !== void 0 &&
						(i.userGuidelinesLengthLimit = t.feature_flags.user_guidelines_length_limit),
					t.feature_flags.vscode_rich_checkpoint_info_min_version !== void 0 &&
						(i.vscodeRichCheckpointInfoMinVersion = t.feature_flags.vscode_rich_checkpoint_info_min_version)
			}
			let s = []
			if (t.languages === void 0) s = XH
			else {
				py("BackGetModelsResult", "languages", t.languages), (s = [])
				for (let a of t.languages) s.push(this.toLanguage(a))
			}
			let o = t.user_tier?.toLowerCase().replace("_tier", "") ?? "unknown"
			return {
				defaultModel: r,
				models: n,
				languages: s,
				featureFlags: i,
				userTier: o,
			}
		}
		async getModelConfig() {
			let t = this._configListener.config,
				r = this.createRequestId()
			return await this.callApi(r, t, "get-models", {}, (i) => this.toGetModelsResult(i))
		}
		async completionFeedback(t) {
			let r = this._configListener.config,
				n = this.createRequestId()
			await this.callApi(
				n,
				r,
				"completion-feedback",
				{ request_id: t.requestId, rating: t.rating, note: t.note },
				void 0,
			)
		}
		async chatFeedback(t) {
			let r = this._configListener.config,
				n = this.createRequestId()
			await this.callApi(
				n,
				r,
				"chat-feedback",
				{
					request_id: t.requestId,
					rating: t.rating,
					note: t.note,
					mode: t.mode,
				},
				void 0,
			)
		}
		async nextEditFeedback(t) {
			let r = this._configListener.config,
				n = this.createRequestId()
			await this.callApi(
				n,
				r,
				"next-edit-feedback",
				{ request_id: t.requestId, rating: t.rating, note: t.note },
				void 0,
				r.nextEdit.url,
			)
		}
		async getAccessToken(t, r, n, i) {
			let s = this._configListener.config,
				o = this.createRequestId(),
				a = {
					grant_type: "authorization_code",
					client_id: s.oauth.clientID,
					code_verifier: n,
					redirect_uri: t,
					code: i,
				}
			return await this.callApi(o, s, "token", a, (l) => l.access_token, r)
		}
		async uploadUserEvents(t) {
			let r = this.createRequestId()
			return await this.callApi(r, this._configListener.config, "record-user-events", { extension_data: t })
		}
		async clientMetrics(t) {
			let r = this._configListener.config,
				n = this.createRequestId()
			await this.callApi(n, r, "client-metrics", { metrics: t }, void 0, void 0, e.defaultRequestTimeoutMs)
		}
		async searchExternalSources(t, r) {
			let n = this._configListener.config,
				i = this.createRequestId()
			return await this.callApi(i, n, "search-external-sources", { query: t, source_types: r }, (s) => s)
		}
		async getImplicitExternalSources(t) {
			let r = this._configListener.config,
				n = this.createRequestId()
			return await this.callApi(n, r, "get-implicit-external-sources", { message: t }, (i) => i)
		}
		convertToAgentCodebaseRetrievalResult(t) {
			return { formattedRetrieval: t.formatted_retrieval }
		}
		async agentCodebaseRetrieval(t, r, n, i, s, o) {
			let a = this._configListener.config
			return await this.callApi(
				t,
				a,
				"agents/codebase-retrieval",
				{
					information_request: r,
					blobs: Ec(n),
					dialog: i,
					max_output_length: s,
				},
				(l) => this.convertToAgentCodebaseRetrievalResult(l),
				a.chat.url,
				12e4,
				void 0,
				o,
			)
		}
		convertToAgentEditFileResult(t) {
			return {
				modifiedFileContents: t.modified_file_contents,
				isError: t.is_error,
			}
		}
		async agentEditFile(t, r, n, i, s, o) {
			let a = this._configListener.config
			return await this.callApi(
				t,
				a,
				"agents/edit-file",
				{
					file_path: r,
					edit_summary: n,
					detailed_edit_description: i,
					file_contents: s,
				},
				(l) => this.convertToAgentEditFileResult(l),
				a.chat.url,
				12e4,
				void 0,
				o,
			)
		}
		convertToToolSafety(t) {
			switch (t) {
				case 0:
					return xt.Unsafe
				case 1:
					return xt.Safe
				case 2:
					return xt.Check
				default:
					return xt.Unsafe
			}
		}
		convertToListRemoteToolsResult(t) {
			return {
				tools: t.tools.map((r) => ({
					toolDefinition: r.tool_definition,
					remoteToolId: r.remote_tool_id,
					availabilityStatus: r.availability_status,
					toolSafety: this.convertToToolSafety(r.tool_safety),
					oauthUrl: r.oauth_url,
				})),
			}
		}
		async listRemoteTools(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(
				r,
				n,
				"agents/list-remote-tools",
				{ tool_id_list: { tool_ids: t } },
				(i) => this.convertToListRemoteToolsResult(i),
				n.chat.url,
				12e4,
			)
		}
		convertToCheckToolSafetyResult(t) {
			return t.is_safe
		}
		async checkToolSafety(t, r) {
			let n = this.createRequestId(),
				i = this._configListener.config
			return await this.callApi(
				n,
				i,
				"agents/check-tool-safety",
				{ tool_id: t, tool_input_json: r },
				(s) => this.convertToCheckToolSafetyResult(s),
				i.chat.url,
				12e4,
			)
		}
		convertToRunRemoteToolResult(t) {
			return {
				toolOutput: t.tool_output,
				toolResultMessage: t.tool_result_message,
				status: t.status,
			}
		}
		async runRemoteTool(t, r, n, i, s, o) {
			let a = this._configListener.config,
				l = {}
			if (s)
				if (i === Li.Jira || i === Li.Confluence) {
					let c = s
					l = {
						extra_tool_input: {
							atlassian_tool_extra_input: {
								server_url: c.serverUrl,
								personal_api_token: c.personalApiToken,
								username: c.username,
							},
						},
					}
				} else
					i === Li.Notion
						? (l = {
								extra_tool_input: {
									notion_tool_extra_input: { api_token: s.apiToken },
								},
							})
						: i === Li.Linear
							? (l = {
									extra_tool_input: {
										linear_tool_extra_input: { api_token: s.apiToken },
									},
								})
							: i === Li.GitHubApi &&
								(l = {
									extra_tool_input: {
										github_tool_extra_input: { api_token: s.apiToken },
									},
								})
			return await this.callApi(
				t,
				a,
				"agents/run-remote-tool",
				{ tool_name: r, tool_input_json: n, tool_id: i, ...l },
				(c) => this.convertToRunRemoteToolResult(c),
				a.chat.url,
				12e4,
				void 0,
				o,
			)
		}
		convertToRevokeToolAccessResult(t) {
			return { status: t.status }
		}
		async revokeToolAccess(t) {
			let r = this.createRequestId(),
				n = this._configListener.config
			return await this.callApi(
				r,
				n,
				"agents/revoke-tool-access",
				{ tool_id: t },
				(i) => this.convertToRevokeToolAccessResult(i),
				n.chat.url,
			)
		}
		reportError(t, r, n, i) {
			return Promise.reject(new Error("reportError should only be used via APIServerImplWithErrorReporting"))
		}
		async reportClientCompletionTimelines(t) {
			let r = this._configListener.config,
				n = this.createRequestId()
			await this.callApi(
				n,
				r,
				"/client-completion-timelines",
				{ timelines: t },
				void 0,
				void 0,
				e.defaultRequestTimeoutMs,
			)
		}
		async checkCommand(t, r, n) {
			let i = this._configListener.config,
				s = { command: t, output: r }
			return await this.callApi(n, i, "check_command", s, (o) => o, i.autofix.autofixUrl, 1e4)
		}
		async containErrors(t, r, n) {
			let i = this._configListener.config,
				s = { command: t, output: r }
			return await this.callApi(n, i, "contain_errors", s, (o) => o, i.autofix.autofixUrl, 1e4)
		}
		async createFixPlan(t, r, n, i, s) {
			let o = this._configListener.config,
				a = {
					output: { command: r, output: n },
					git_diff: t,
					edit_locations: i,
				}
			return await this.callApi(s, o, "create_fix_plan", a, (l) => l, o.autofix.autofixUrl, 3e4)
		}
		async applyFileFix(t, r, n) {
			let i = this._configListener.config,
				s = { file_fix: t, source_content: r }
			return await this.callApi(n, i, "apply_file_fix", s, (o) => o, i.autofix.autofixUrl, 3e4)
		}
		async autofixCheck(t) {
			let r = this._configListener.config,
				n = this.createRequestId()
			return await this.callApi(
				n,
				r,
				"/autofix/check",
				{ command: this.toAutofixCommandPayload(t) },
				(i) => this.convertToAutofixCheckResponse(i),
				r.autofix.autofixUrl,
				1e4,
			)
		}
		async autofixPlan(t, r, n, i) {
			let s = this._configListener.config,
				o = this.createRequestId()
			return await this.callApi(
				o,
				s,
				"/autofix/plan",
				{
					command: this.toAutofixCommandPayload(t),
					vcs_change: this.toVCSChangePayload(r),
					blobs: Ec(n),
					steering_history: (i || []).map((a) => ({
						request_message: a.requestMessage,
						summary: a.summary,
						replacements: a.replacements.map((l) => this.toBackTextReplacement(l)),
						request_id: a.requestId,
					})),
				},
				(a) => this.convertToAutofixPlanResponse(a),
				s.autofix.autofixUrl,
				6e4,
			)
		}
		async saveChat(t, r, n) {
			let i = this._configListener.config,
				s = this.createRequestId(),
				o = {
					conversation_id: t,
					chat: r.map((l) => ({
						request_message: l.request_message,
						response_text: l.response_text,
						request_id: l.request_id,
					})),
					title: n,
				}
			return await this.callApi(s, i, "/save-chat", o, (l) => l, i.chat.url, e.defaultRequestTimeoutMs)
		}
	},
	ik = class extends nW {
		constructor(t, r, n, i, s) {
			super(t, r, n, i, s)
		}
		async callApi(t, r, n, i, s = (f) => f, o, a, l, c, u) {
			let f = Date.now()
			try {
				return await super.callApi(t, r, n, i, s, o, a, l, c, u)
			} catch (p) {
				throw (await this.handleError(p, n, i, o ?? "", t, f), p)
			}
		}
		async handleError(t, r, n, i, s, o) {
			if (kr.isAPIErrorWithStatus(t, He.cancelled)) throw t
			let l = [
					{
						key: "body_length",
						value: `${JSON.stringify(n, (p, g) => (g === void 0 ? null : g)).length}`,
					},
					{ key: "start_time", value: `${o}` },
					{ key: "end_time", value: `${Date.now()}` },
					{ key: "message", value: Ye(t) },
				],
				c = t instanceof Error ? t.stack : void 0
			t instanceof kr &&
				t.status === He.augmentTooLarge &&
				l.push({ key: "object_size_breakdown", value: `${Ay(n)}` })
			let u = t instanceof kr ? t.status : He.unknown,
				f = `${r} call failed with APIStatus ${He[u]}`
			throw (
				(t instanceof nk && (f = `converting ${r} response failed`),
				i && this.getUniqueExtraURLs().has(i)
					? this._logger.error(`API error ${r} to ${i}: ${f}`)
					: await this.reportError(s, f, c ?? "", l),
				t)
			)
		}
		async callApiStream(t, r, n, i, s, o, a, l) {
			let c = Date.now()
			try {
				return await super.callApiStream(t, r, n, i, s, o, a, l)
			} catch (u) {
				throw (await this.handleError(u, n, i, o ?? "", t, c), u)
			}
		}
		async reportError(t, r, n, i) {
			let s = this._configListener.config,
				o = this.createRequestId(),
				a = n.replace(/ \(\/[^()]+\)/g, "")
			try {
				return await super.callApi(
					o,
					s,
					"report-error",
					{
						original_request_id: t,
						sanitized_message: r,
						stack_trace: a,
						diagnostics: i,
					},
					void 0,
					void 0,
					500,
				)
			} catch (l) {
				this._logger.error(`Dropping error report "${r}" due to error: ${Ye(l)}`)
			}
		}
	},
	Yp = class extends Error {
		constructor() {
			super("The completion URL setting is invalid")
		}
	},
	iW = class {
		_sequenceId = 0
		next() {
			return this._sequenceId++
		}
	}