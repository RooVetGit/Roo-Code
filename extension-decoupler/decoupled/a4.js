
/**
 * Creates a new instance of the d4 class.
 * 
 * This function is a higher-order function that takes several parameters 
 * (e, t, r, n, i, s) and returns another function. The returned function 
 * accepts two parameters (o, a) and uses them, along with the original 
 * parameters, to create and return a new instance of the d4 class. 
 * This pattern allows for the creation of d4 instances with pre-defined 
 * configurations based on the initial parameters.
 * 
 * @param {any} e - The first parameter used in the d4 constructor.
 * @param {any} t - The second parameter used in the d4 constructor.
 * @param {any} r - The third parameter used in the d4 constructor.
 * @param {any} n - The fourth parameter used in the d4 constructor.
 * @param {any} i - The fifth parameter used in the d4 constructor.
 * @param {any} s - The sixth parameter used in the d4 constructor.
 * @returns {function} A function that takes two parameters (o, a) and returns a new instance of d4.
 */
var sCe = (e, t, r, n, i, s) => (o, a) => new d4(o, t, e, a, r, n, i, s),
	d4 = class e extends hm {
		constructor(r, n, i, s, o, a, l, c) {
			let u = [],
				f = process.platform === "win32" ? "powershell" : "bash",
				p,
				g
			r === Mn.agent
				? (u.push(new f4(n, o, i)),
					a.currentFlags?.vscodeAgentEditTool !== YI.strReplaceEditor &&
						(u.push(new jk(n)), u.push(new h4(n, i, o))),
					u.push(new g4(i, o, a, c)),
					u.push(new p4()),
					s().useIDETerminalForShellCommands
						? ((g = new Gk(f, l, c)),
							u.push(new Ny(n, s, g, f)),
							u.push(new $k(g)),
							u.push(new Yk(g, n)),
							u.push(new Kk(g)),
							u.push(new Jk(g)),
							u.push(new zk(g)))
						: ((p = new A4()),
							u.push(new m4(n, s, p, f)),
							u.push(new y4(p)),
							u.push(new C4(p)),
							u.push(new v4(p)),
							u.push(new E4(p)),
							u.push(new b4(p))))
				: u.push(new jk(n))
			super(u, Ro.localToolHost)
			this._chatMode = r
			this._workspaceManager = n
			this._apiServer = i
			this._getAgentConfig = s
			this._checkpointManager = o
			this._featureFlagManager = a
			this._extensionRoot = l
			this._agentSessionEventReporter = c
			;(this._processTools = p), (this._terminalProcessTools = g)
		}
		_processTools
		_terminalProcessTools
		async close(r = !1) {
			await super.close(),
				this._processTools !== void 0 && this._processTools.close(),
				this._terminalProcessTools !== void 0 && this._terminalProcessTools.cleanup()
		}
		closeAllToolProcesses() {
			return (
				this._processTools !== void 0 && this._processTools.close(),
				this._terminalProcessTools !== void 0 && this._terminalProcessTools.closeAllProcesses(),
				Promise.resolve()
			)
		}
		factory(r) {
			return new e(
				this._chatMode,
				this._workspaceManager,
				this._apiServer,
				this._getAgentConfig,
				this._checkpointManager,
				this._featureFlagManager,
				this._extensionRoot,
				this._agentSessionEventReporter,
			)
		}
	},
	/**
	 * jk class extends the rn class and provides functionality to read a file 
	 * from the workspace. This class is part of a toolset that interacts with 
	 * the file system to perform read operations.
	 * 
	 * The constructor initializes the class with a workspace manager that 
	 * manages the context in which files are accessed.
	 * 
	 * The `description` property provides a brief overview of the tool's 
	 * purpose, which is to read a file.
	 * 
	 * The `inputSchemaJson` defines the expected input structure, requiring 
	 * a `file_path` property that specifies the path of the file to be read.
	 * 
	 * The `checkToolCallSafe` method ensures that the tool can be called 
	 * safely without any additional checks.
	 * 
	 * The `call` method takes the input parameters, attempts to read the 
	 * specified file, and returns the file's content or an error message 
	 * if the file cannot be read.
	 */
	jk = class extends rn {
		constructor(r) {
			super(On.readFile, xt.Safe)
			this._workspaceManager = r
		}
		description = "Read a file."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "The path of the file to read.",
				},
			},
			required: ["file_path"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		async call(r, n, i) {
			let s = r.file_path
			try {
				let o = await Sy(s, this._workspaceManager)
				return o === void 0 ? ut(`Cannot read file: ${s}`) : Zt(o)
			} catch (o) {
				return ut(`Failed to read file: ${s}: ${o.message ?? ""}`)
			}
		}
	},
	f4 = class extends rn {
		constructor(r, n, i) {
			super(On.saveFile, xt.Safe)
			this._workspaceManager = r
			this._checkpointManager = n
			this._requestIdCreator = i
		}
		description =
			"Save a new file. Use this tool to write new files with the attached content. It CANNOT modify existing files. Do NOT use this tool to edit an existing file by overwriting it entirely. Use the str-replace-editor tool to edit existing files instead."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "The path of the file to save.",
				},
				file_content: {
					type: "string",
					description: "The content of the file.",
				},
				add_last_line_newline: {
					type: "boolean",
					description: "Whether to add a newline at the end of the file (default: true).",
				},
			},
			required: ["file_path", "file_content"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		async call(r, n, i) {
			let s = r.file_path
			try {
				let o = r.file_content,
					a = r.add_last_line_newline ?? !0,
					l =
						o +
						(a
							? `
`
							: ""),
					c = (await Sy(s, this._workspaceManager)) ?? "",
					u = Du(s, this._workspaceManager)
				if (u === void 0) return ut(`Cannot resolve path: ${s}`)
				if (Pn(u.absPath)) return ut(`File already exists: ${u.absPath}`)
				let f = new hi(u, c, l, {})
				if (c === l) return f.dispose(), Zt(`No changes made to file {${s}}`)
				let p = n.at(-1)?.request_id ?? this._requestIdCreator.createRequestId(),
					g = this._checkpointManager.currentConversationId ?? ""
				return (
					await this._checkpointManager.addCheckpoint(
						{ conversationId: g, path: u },
						{
							sourceToolCallRequestId: p,
							timestamp: Date.now(),
							document: f,
							conversationId: g,
						},
					),
					Zt(`File saved.  Saved file {${s}}`)
				)
			} catch (o) {
				return ut(`Failed to save file: ${s}: ${o.message ?? ""}`)
			}
		}
	},
    // add
	h4 = class extends rn {
		/**
		 * Class representing a tool to edit files.
		 * 
		 * This tool allows for editing entire files by providing a file path and a detailed description of the edit.
		 * The description should be precise and include all necessary information to perform the edit, 
		 * including natural language and code snippets.
		 * 
		 * Example usage:
		 * 
		 * <begin-example>
		 * Add a function called foo.
		 * 
		 * ```
		 * def foo():
		 *     ...
		 * ```
		 * </end-example>
		 * 
		 * The tool will also handle diagnostics and provide feedback on the editing process.
		 */
		constructor(r, n, i) {
			super(On.editFile, xt.Safe)
			this._workspaceManager = r
			this._apiServer = n
			this._checkpointManager = i
		}
		_maxDiagnosticDelayMs = 5e3
		description = `
Edit a file. Accepts a file path and a description of the edit.
This tool can edit whole files.
The description should be detailed and precise, and include all required information to perform the edit.
It can include both natural language and code. It can include multiple code snippets to described different
edits in the file. It can include descriptions of how to perform these edits precisely.

All the contents that should go in a file should be placed in a markdown code block, like this:

<begin-example>
Add a function called foo.

\`\`\`
def foo():
    ...
\`\`\`
</end-example>

This includes all contents, even if it's not code.

Be precise or I will take away your toys.

Prefer to use this tool when editing parts of a file.
`
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "The path of the file to edit.",
				},
				edit_summary: {
					type: "string",
					description: "A brief description of the edit to be made. 1-2 sentences.",
				},
				detailed_edit_description: {
					type: "string",
					description:
						"A detailed and precise description of the edit. Can include natural language and code snippets.",
				},
			},
			required: ["file_path", "edit_summary", "detailed_edit_description"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		/**
		 * Asynchronously handles the editing of a file.
		 * 
		 * This method takes in a request object containing the file path, 
		 * an edit summary, and a detailed edit description. It attempts to 
		 * read the specified file, apply the edits, and manage diagnostics 
		 * related to the file. If successful, it saves the changes and 
		 * updates the checkpoint manager with the new state.
		 * 
		 * @param {Object} r - The request object containing file edit details.
		 * @param {Array} n - An array of previous requests for context.
		 * @param {Object} i - Additional information for the edit operation.
		 * @returns {Promise<string>} - A message indicating the result of the edit operation.
		 * 
		 * @example
		 * const request = {
		 *     file_path: "path/to/file.js",
		 *     edit_summary: "Fix typo in function name",
		 *     detailed_edit_description: "Change 'fucntionName' to 'functionName' in the specified file."
		 * };
		 * 
		 * const result = await this.call(request, previousRequests, additionalInfo);
		 * console.log(result); // Outputs the result of the edit operation.
		 */
		async call(r, n, i) {
			let s = r.file_path,
				o
			try {
				let a = r.edit_summary,
					l = r.detailed_edit_description,
					c = await Sy(s, this._workspaceManager)
				if (c === void 0) return ut(`Cannot read file: ${s}`)
				let u = Du(s, this._workspaceManager)
				if (u === void 0) return ut(`Cannot resolve path: ${s}`)
				let f = this._getDiagnostics()
				o = this._apiServer.createRequestId()
				let p = await this._apiServer.agentEditFile(o, s, a, l, c, i)
				if (p.isError) return ut(`Failed to edit file: ${s}`, o)
				let g = new hi(u, c, p.modifiedFileContents, {})
				if (c === p.modifiedFileContents) return g.dispose(), Zt(`No changes made to file {${s}}`, o)
				let m = n.at(-1)?.request_id ?? o,
					y = this._checkpointManager.currentConversationId ?? ""
				await this._checkpointManager.addCheckpoint(
					{ conversationId: y, path: u },
					{
						sourceToolCallRequestId: m,
						timestamp: Date.now(),
						document: g,
						conversationId: y,
					},
				)
				let C = await this._waitForNewDiagnostics(f),
					v = this._filterDiagnosticsMap(C, f),
					b = Array.from(v.entries()).map(
						([Q, O]) => `${Q}
${O.map((Y) => `${Y.range.start.line}-${Y.range.end.line}: ${Y.message}`).join(`
`)}`,
					).join(`

`),
					w = C.get(u.absPath) ?? [],
					M = this._filterDiagnostics(w, v.get(u.absPath) ?? []).map(
						(Q) => `${Q.range.start.line}-${Q.range.end.line}: ${Q.message}`,
					).join(`
`)
				return Zt(
					`File edited successfully.  Saved file {${s}}.  New diagnostics:
${b}

Additional ${s} diagnostics:
${M}`,
					o,
				)
			} catch (a) {
				return ut(`Failed to edit file: ${s}: ${a.message ?? ""}`, o)
			}
		}
		_getDiagnostics() {
			let r = new Map()
			return (
				Py.languages.getDiagnostics().forEach(([n, i]) => {
					i.length > 0 && r.set(n.fsPath, i)
				}),
				r
			)
		}
		_filterDiagnosticsMap(r, n) {
			let i = new Map()
			return (
				r.forEach((s, o) => {
					let a = n.get(o) ?? [],
						l = this._filterDiagnostics(s, a)
					l.length > 0 && i.set(o, l)
				}),
				i
			)
		}
		_filterDiagnostics(r, n) {
			return r.filter(
				(i) =>
					!n.some(
						(s) =>
							i.range.start.line === s.range.start.line &&
							i.range.end.line === s.range.end.line &&
							i.message === s.message &&
							i.severity === s.severity,
					),
			)
		}
		async _waitForNewDiagnostics(r) {
			let n = Date.now(),
				i = this._getDiagnostics()
			for (; Date.now() - n < this._maxDiagnosticDelayMs; ) {
				let s = this._getDiagnostics(),
					o = this._filterDiagnosticsMap(s, r)
				if (this._hasDifferentDiagnostics(o, this._filterDiagnosticsMap(i, r))) return s
				;(i = s), await Kl(1e3)
			}
			return i
		}
		_hasDifferentDiagnostics(r, n) {
			if (r.size !== n.size) return !0
			for (let [i, s] of r) {
				let o = n.get(i)
				if (!o || s.length !== o.length) return !0
				for (let a = 0; a < s.length; a++) {
					let l = s[a],
						c = o[a]
					if (
						l.range.start.line !== c.range.start.line ||
						l.range.end.line !== c.range.end.line ||
						l.message !== c.message ||
						l.severity !== c.severity
					)
						return !0
				}
			}
			return !1
		}
	},
	g4 = class extends rn {
		constructor(r, n, i, s) {
			super(On.remember, xt.Safe)
			this._apiServer = r
			this._checkpointManager = n
			this._featureFlagManager = i
			this._agentSessionEventReporter = s
			this.memoryRingBuffer = new Gc(this.maxMemoryBufferSize)
		}
		modelName = void 0
		memoryRingBuffer
		maxMemoryBufferSize = 1e3
		description = `Call this tool when user asks you:
- to remember something
- to create memory/memories

Use this tool only with information that can be useful in the long-term.
Do not use this tool for temporary information.
`
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				memory: {
					type: "string",
					description: "The concise (1 sentence) memory to remember.",
				},
			},
			required: ["memory"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		async call(r, n, i) {
			let s = r.memory
			this.memoryRingBuffer.addItem(s)
			let o = r.isComplexNewMemory ?? !1,
				a = r.caller ?? fk.unspecified,
				l = r.memoriesRequestId,
				c = hk.create(a, o)
			if (
				((this.modelName = this._featureFlagManager.currentFlags.memoriesParams?.remember_tool_model_name),
				!this.modelName)
			)
				return c.setFlag(Wr.rememberToolModelNameMissing), ut("Failed to save memory.")
			this.modelName === "default" && (this.modelName = void 0), l && c.setRequestId(Wr.memoriesRequestId, l)
			let u
			try {
				u = await this.injectMemories(s, o, c)
			} catch {
				c.setFlag(Wr.exceptionThrown)
			} finally {
				u === void 0 && (u = ut("Failed to save memory.")),
					c.setFlag(Wr.toolOutputIsError, u.isError),
					this._agentSessionEventReporter.reportEvent({
						eventName: Is.rememberToolCall,
						conversationId: "",
						eventData: { rememberToolCallData: c },
					})
			}
			return u
		}
		async injectMemories(r, n, i) {
			i.setFlag(Wr.injectionStarted)
			let s = await vk(this._checkpointManager.getAgentMemoriesAbsPath)
			if ((i.setStringStats(Wr.injectionCurrentMemoriesStats, s), !s))
				return (
					r.trim().split(`
`).length === 1 && (r = `- ${r}`),
					this._setMemories(r, "", i)
				)
			let o
			if (
				(n
					? (o = this._featureFlagManager.currentFlags.memoriesParams.complex_injection_prompt)
					: (o = this._featureFlagManager.currentFlags.memoriesParams.injection_prompt),
				!o)
			)
				return i.setFlag(Wr.injectionPromptMissing), ut("Failed to save memory.")
			;(o = o.replace("{currentMemories}", s).replace("{newMemory}", r)),
				i.setStringStats(Wr.injectionPromptStats, o)
			try {
				let a = this._apiServer.createRequestId()
				i.setRequestId(Wr.injectionRequestId, a)
				let l = await this._callModel(o, a, i)
				return i.setStringStats(Wr.injectionUpdatedMemoriesStats, l), this._setMemories(l, s, i)
			} catch {
				return i.setFlag(Wr.injectionFailed), ut("Failed to save memory.")
			}
		}
		async _callModel(r, n, i) {
			let s = await Kp(r, n, [], [], [], Mn.chat, this.modelName)
			for await (let { nodes: o = [] } of s) {
				let a = o.find((l) => l.type === Jl.RAW_RESPONSE)?.content
				if (a) {
					let l = a.indexOf("```"),
						c = a.lastIndexOf("```")
					return l !== -1 && c !== -1 && c > l + 3
						? a.substring(l + 3, c).trim()
						: (i.setFlag(Wr.injectionNoCodeWrapper),
							a
								.trim()
								.replace(/^`+|`+$/g, "")
								.trim())
				}
			}
			throw new Error("Model call failed")
		}
		async _setMemories(r, n, i) {
			i.setFlag(Wr.setMemoriesStart)
			let s = this._featureFlagManager.currentFlags.memoriesParams.upper_bound_size
			if (!s)
				return (
					i.setFlag(Wr.setMemoriesUpperBoundSizeMissing),
					Promise.resolve(ut("Failed to save memories: upper bound size missing"))
				)
			let o = r
				.split(
					`
`,
				)
				.filter((u) => u.trim()).length
			i.setNum(Wr.setMemoriesNonEmptyLines, o), o >= s && (r = await this._compressMemories(r, i))
			let a = this._checkpointManager.getAgentMemoriesAbsPath()
			if (!a)
				return (
					i.setFlag(Wr.setMemoriesNoMemoriesFile),
					Promise.resolve(ut("Failed to save memories: no memories file available"))
				)
			let l = new Mk(new Je("", a), n, n, {}),
				c = l.updateBuffer(r)
			return (
				i.setFlag(Wr.setMemoriesUpdateBufferFailed, !c),
				r === n
					? (i.setFlag(Wr.setMemoriesNoChangesMade),
						l.dispose(),
						Promise.resolve(Zt("No changes made to memories")))
					: (l.dispose(),
						Promise.resolve(c ? Zt("Memories saved successfully.") : ut("Failed to update buffer")))
			)
		}
		async _compressMemories(r, n) {
			n.setFlag(Wr.compressionStarted)
			let i = this._featureFlagManager.currentFlags.memoriesParams.compression_target
			if (!i) return n.setFlag(Wr.compressionTargetMissing), r
			let s = this._featureFlagManager.currentFlags.memoriesParams.compression_prompt
			if (!s) return n.setFlag(Wr.compressionPromptMissing), r
			let o = this._featureFlagManager.currentFlags.memoriesParams.num_recent_memories_to_keep
			if (o === void 0) return n.setFlag(Wr.compressionNumRecentMemoriesToKeepMissing), r
			if (
				(n.setNum(Wr.compressionMemoriesQueueSize, this.memoryRingBuffer.length),
				o > 0 && s.includes("{recentMemoriesSubprompt}") && this.memoryRingBuffer.length > 0)
			) {
				let a = this._featureFlagManager.currentFlags.memoriesParams.recent_memories_subprompt
				if (a === void 0) return n.setFlag(Wr.compressionRecentMemoriesSubpromptMissing), r
				let l = this.memoryRingBuffer.slice(-o).map((c) => `- ${c}`).join(`
`)
				;(a = a.replace("{recentMemories}", l)), (s = s.replace("{recentMemoriesSubprompt}", a))
			}
			;(s = s.replace("{memories}", r).replace("{compressionTarget}", i.toString())),
				n.setStringStats(Wr.compressionPromptStats, s)
			try {
				let a = this._apiServer.createRequestId()
				n.setRequestId(Wr.compressionRequestId, a)
				let l = await this._callModel(s, a, n)
				return n.setStringStats(Wr.compressionMemoriesStats, l), l
			} catch {
				return n.setFlag(Wr.compressionFailed), r
			}
		}
	},
	p4 = class extends rn {
		constructor() {
			super(On.openBrowser, xt.Safe)
		}
		description = `Open a URL in the default browser.

1. The tool takes in a URL and opens it in the default browser.
2. The tool does not return any content. It is intended for the user to visually inspect and interact with the page. You will not have access to it.`
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				url: { type: "string", description: "The URL to open in the browser." },
			},
			required: ["url"],
		})
		checkToolCallSafe(t) {
			return !0
		}
		async call(t, r, n) {
			try {
				let i = t.url,
					s = Py.Uri.parse(i)
				return (await Py.env.openExternal(s))
					? Zt(`Opened ${i} in browser`)
					: ut(`Failed to open ${i} in browser: system denied the request`)
			} catch (i) {
				return ut(`Failed to open URL in browser: ${i.message ?? ""}`)
			}
		}
	},
	A4 = class {
		_processes = new Map()
		_stdoutBuffers = new Map()
		_stderrBuffers = new Map()
		_lastReadStdout = new Map()
		_lastReadStderr = new Map()
		_charBudget
		constructor(t = 1e5) {
			this._charBudget = t
		}
		launch(t, r, n, i) {
			let s = { cwd: r, shell: i, stdio: ["pipe", "pipe", "pipe"], signal: n }
			;(Wx.default.platform() === "linux" || Wx.default.platform() === "darwin") && (s.detached = !0)
			let o = (0, Zk.spawn)(t, [], s)
			if (o.pid == null) return
			let a = o.pid
			return (
				this._processes.set(a, o),
				this._stdoutBuffers.set(a, []),
				this._stderrBuffers.set(a, []),
				this._lastReadStdout.set(a, 0),
				this._lastReadStderr.set(a, 0),
				o.stdout?.on("data", (l) => {
					let c = this._stdoutBuffers.get(a)
					for (c.push(l.toString("utf8")); c.join("").length > this._charBudget; ) c.shift()
				}),
				o.stderr?.on("data", (l) => {
					let c = this._stderrBuffers.get(a)
					for (c.push(l.toString("utf8")); c.join("").length > this._charBudget; ) c.shift()
				}),
				o.on("close", () => {}),
				a
			)
		}
		kill(t) {
			let r = this._processes.get(t)
			try {
				return Wx.default.platform() === "linux" || Wx.default.platform() === "darwin"
					? ((0, Zk.execSync)(`kill -9 -${t}`), !0)
					: (r && r.kill(), !0)
			} catch {
				return !1
			}
		}
		readOutput(t) {
			let r = this._processes.get(t)
			if (!r) return
			let n = this._stdoutBuffers.get(t),
				i = this._stderrBuffers.get(t),
				s = this._lastReadStdout.get(t),
				o = this._lastReadStderr.get(t),
				a = n.slice(s).join(""),
				l = i.slice(o).join("")
			return (
				this._lastReadStdout.set(t, n.length),
				this._lastReadStderr.set(t, i.length),
				{ stdout: a, stderr: l, returnCode: r.exitCode }
			)
		}
		writeInput(t, r) {
			let n = this._processes.get(t)
			return !n || !n.stdin ? !1 : n.stdin.write(r)
		}
		listProcesses() {
			let t = []
			for (let [r, n] of this._processes.entries()) {
				let i = n.killed ? "killed" : n.exitCode !== null ? "completed" : "running"
				t.push({
					pid: r,
					command: n.spawnargs.join(" "),
					state: i,
					returnCode: n.exitCode,
				})
			}
			return t
		}
		waitForProcess(t, r, n) {
			return new Promise((i) => {
				let s = this._processes.get(t)
				if (!s) {
					i({ stdout: "", stderr: "", returnCode: null })
					return
				}
				let o = setTimeout(() => {
					let a = this.readOutput(t)
					i({
						stdout: a?.stdout ?? "",
						stderr: a?.stderr ?? "",
						returnCode: null,
					})
				}, r * 1e3)
				n.addEventListener("abort", () => {
					clearTimeout(o), i({ stdout: "", stderr: "", returnCode: null })
				}),
					s.on("close", (a) => {
						clearTimeout(o)
						let l = this.readOutput(t)
						i({
							stdout: l?.stdout ?? "",
							stderr: l?.stderr ?? "",
							returnCode: a,
						})
					})
			})
		}
		close() {
			for (let t of this._processes.values()) !t.killed && t.exitCode === null && t.pid && this.kill(t.pid)
			this._processes.clear(),
				this._stdoutBuffers.clear(),
				this._stderrBuffers.clear(),
				this._lastReadStdout.clear(),
				this._lastReadStderr.clear()
		}
	},
	/**
	 * @class
	 * @classdesc ProcessTool is a custom tool that runs a shell command.
	 * It can be either a waiting or non-waiting tool.
	 * If it is a waiting tool, it will launch the process in an interactive terminal and wait for the process to complete up to `wait_seconds` seconds (default: 60 seconds).
	 * If the process ends during this period, the tool call returns. If the timeout expires, the process will continue running in the background.
	 * If it is a non-waiting tool, it will launch the process in the background and return immediately.
	 */
	m4 = class e extends rn {
		constructor(r, n, i, s) {
			super(On.launchProcess, n().shellCommandsAlwaysSafe ? xt.Safe : xt.Check)
			this._workspaceManager = r
			this._getAgentConfig = n
			this._processTools = i
			this._shellName = s
			this._allowlist = ym(process.platform, this._shellName)
		}
		static defaultWaitSeconds = 60
		_allowlist
		version = 2
		description = `Launch a new process with a shell command. A process can be waiting (\`wait=true\`) or non-waiting (\`wait=false\`, which is default).

If \`wait=true\`, launches the process in an interactive terminal, and waits for the process to complete up to
\`wait_seconds\` seconds (default: ${e.defaultWaitSeconds}). If the process ends
during this period, the tool call returns. If the timeout expires, the process will continue running in the
background but the tool call will return. You can then interact with the process using the other process tools.

Note: Only one waiting process can be running at a time. If you try to launch a process with \`wait=true\`
while another is running, the tool will return an error.

If \`wait=false\`, launches a background process in a separate terminal. This returns immediately, while the
process keeps running in the background.

Notes:
- Use \`wait=true\` processes when the command is expected to be short, or when you can't
proceed with your task until the process is complete. Use \`wait=false\` for processes that are
expected to run in the background, such as starting a server you'll need to interact with, or a
long-running process that does not need to complete before proceeding with the task.
- If this tool returns while the process is still running, you can continue to interact with the process
using the other available tools. You can wait for the process, read from it, write to it, kill it, etc.
- You can use this tool to interact with the user's local version control system. Do not use the
retrieval tool for that purpose.
- If there is a more specific tool available that can perform the function, use that tool instead of
this one.

The OS is ${process.platform}.`
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				command: {
					type: "string",
					description: "The shell command to execute",
				},
				wait: {
					type: "boolean",
					description: "Optional: whether to wait for the command to complete (default false)",
				},
				wait_seconds: {
					type: "number",
					description:
						"Optional: number of seconds to wait for the command to complete (default 60). Only relevant when wait=true.",
				},
				cwd: {
					type: "string",
					description:
						"Working directory for the command. If not supplied, uses the current working directory.",
				},
			},
			required: ["command"],
		})
		checkToolCallSafe(r) {
			if (this._getAgentConfig().shellCommandsAlwaysSafe) return !0
			let n = r.command
			return Cm(this._allowlist, n, this._shellName)
		}
		async call(r, n, i) {
			try {
				let s = r.command,
					o = r.wait ?? !1,
					a = r.wait_seconds ?? e.defaultWaitSeconds
				if (!o && a !== void 0) return ut("You cannot set wait_seconds without wait=true.")
				let l = r.cwd ?? Kd(this._workspaceManager),
					c = this._processTools.launch(s, l, i, this._shellName)
				if (c === void 0) return ut("Failed to launch process")
				if (!o) return Zt(`Process launched with PID ${c}`)
				let u = await this._processTools.waitForProcess(c, a, i)
				return u.returnCode === null
					? Zt(`Command is still running after ${o} seconds. You can use read_process to get more output
and kill_process to terminate it if needed.
PID ${c}
Output so far:
<stdout>
${u.stdout}
</stdout>
<stderr>
${u.stderr}
</stderr>`)
					: Zt(`Here are the results from executing the command.
<return-code>
${u.returnCode}
</return-code>
<stdout>
${u.stdout}
</stdout>
<stderr>
${u.stderr}
</stderr>`)
			} catch (s) {
				return ut(`Failed to launch process: ${s.message ?? ""}`)
			}
		}
	},
	y4 = class extends rn {
		constructor(r) {
			super(On.killProcess, xt.Safe)
			this._processTools = r
		}
		description = "Kill a process by its process ID."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				process_id: { type: "integer", description: "Process ID to kill." },
			},
			required: ["process_id"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		call(r, n, i) {
			let s = r.process_id
			return this._processTools.kill(s)
				? Promise.resolve(Zt(`Process ${s} killed`))
				: Promise.resolve(ut(`Process ${s} not found`))
		}
	},
	C4 = class extends rn {
		constructor(r) {
			super(On.readProcess, xt.Safe)
			this._processTools = r
		}
		description = "Read output from a running process."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				process_id: {
					type: "integer",
					description: "Process ID to read from.",
				},
			},
			required: ["process_id"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		call(r, n, i) {
			let s = r.process_id,
				o = this._processTools.readOutput(s)
			if (!o) return Promise.resolve(ut(`Process ${s} not found`))
			let a = o.returnCode !== null ? "completed" : "still running",
				l = `Here is the output from process ${s} (status: ${a}):
<stdout>
${o.stdout}
</stdout>
<stderr>
${o.stderr}
</stderr>`
			return (
				o.returnCode !== null &&
					(l += `
<return-code>
${o.returnCode}
</return-code>`),
				Promise.resolve(Zt(l))
			)
		}
	},
	v4 = class extends rn {
		constructor(r) {
			super(On.writeProcess, xt.Safe)
			this._processTools = r
		}
		description = "Write input to a process's stdin."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				process_id: { type: "integer", description: "Process ID to write to." },
				input_text: {
					type: "string",
					description: "Text to write to the process's stdin.",
				},
			},
			required: ["process_id", "input_text"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		call(r, n, i) {
			let s = r.process_id,
				o = r.input_text
			return this._processTools.writeInput(s, o)
				? Promise.resolve(Zt(`Input written to process ${s}`))
				: Promise.resolve(ut(`Process ${s} not found or write failed`))
		}
	},
	E4 = class extends rn {
		constructor(r) {
			super(On.listProcesses, xt.Safe)
			this._processTools = r
		}
		description = "List all known processes and their states."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {},
			required: [],
		})
		checkToolCallSafe(r) {
			return !0
		}
		call(r, n, i) {
			let s = this._processTools.listProcesses()
			if (s.length === 0) return Promise.resolve(Zt("No processes found"))
			let o = s.map((a) => {
				let l = a.state
				return (
					a.returnCode !== null && (l += ` (return code: ${a.returnCode})`),
					`PID ${a.pid}: ${a.command} - ${l}`
				)
			})
			return Promise.resolve(
				Zt(
					`Here are all known processes:

` +
						o.join(`
`),
				),
			)
		}
	},
	b4 = class extends rn {
		constructor(r) {
			super(On.waitProcess, xt.Safe)
			this._processTools = r
		}
		description = "Wait for a process to complete or timeout."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				process_id: { type: "integer", description: "Process ID to wait for." },
				wait: {
					type: "number",
					description: "Number of seconds to wait for the process to complete.",
				},
			},
			required: ["process_id", "wait"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		async call(r, n, i) {
			let s = r.process_id,
				o = r.wait,
				a = await this._processTools.waitForProcess(s, o, i)
			return a.returnCode === null
				? Zt(`Command still running after ${o} seconds.`)
				: Zt(`Process ${s} completed with return code ${a.returnCode}.`)
		}
	}