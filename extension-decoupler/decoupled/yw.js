
var mW = class {
		constructor(t, r, n, i) {
			this.workspaceManager = t
			this.apiServer = r
			this.logger = n
			this.progressTracker = i
		}
		toolDefinitions = [
			{
				name: "ls",
				description: "Lists a content of a folder by a relative path to it.",
				input_schema_json: JSON.stringify({
					type: "object",
					properties: {
						folder: {
							type: "string",
							description: "Relative path to a folder. Can be either '.' or './*'",
						},
					},
					required: ["folder"],
				}),
				tool_safety: xt.Safe,
			},
			{
				name: "read-file",
				description: "Read a file.",
				input_schema_json: JSON.stringify({
					type: "object",
					properties: {
						file_path: {
							type: "string",
							description: "The path of the file to read.",
						},
					},
					required: ["file_path"],
				}),
				tool_safety: xt.Safe,
			},
			{
				name: "complete",
				description: "Tool which should be called at the very end to return final response.",
				input_schema_json: JSON.stringify({
					type: "object",
					properties: {
						response: {
							type: "string",
							description: "Final response to the user.",
						},
					},
					required: ["response"],
				}),
				tool_safety: xt.Safe,
			},
			{
				name: "codebase-retrieval",
				description:
					"Use this tool to request information from the codebase. It will return relevant snippets for the requested information.",
				input_schema_json: JSON.stringify({
					type: "object",
					properties: {
						information_request: {
							type: "string",
							description: "A description of the information you need.",
						},
					},
					required: ["information_request"],
				}),
				tool_safety: xt.Safe,
			},
		]
		getToolDefinitions() {
			return this.toolDefinitions
		}
		async runTool(t, r) {
			switch (t) {
				case "codebase-retrieval": {
					let n = this.apiServer.createRequestId(),
						i = r.information_request
					try {
						let s = await this.apiServer.agentCodebaseRetrieval(
							n,
							i,
							this.workspaceManager.getContext().blobs,
							[],
							2e4,
						)
						return Zt(s.formattedRetrieval, n)
					} catch (s) {
						return (
							this.logger.error(`Failed to retrieve codebase information: ${s}`),
							ut("Failed to retrieve codebase information.")
						)
					}
				}
				case "ls": {
					let n = r.folder,
						i = Du(n, this.workspaceManager)?.absPath
					if (i === void 0) return ut(`Failed to list directory: ${n}`)
					if (!(await $d(i))) return ut(`Directory does not exist: ${n}`)
					try {
						let o = (await Ex(i)).map(([a, l]) => a)
						return Zt(
							o.join(`
`),
						)
					} catch {
						return this.logger.error(`Failed to list directory: ${n}`), ut(`Failed to list directory: ${n}`)
					}
				}
				case "read-file": {
					let n = r.file_path,
						i = Du(n, this.workspaceManager)?.absPath
					if (i === void 0) return ut(`Failed to read file: ${n}`)
					if (!Pn(i)) return ut(`File does not exist: ${n}`)
					let s = await Fr(i)
					return s === void 0
						? (this.logger.error(`Failed to read file: ${n}`), ut(`Failed to read file: ${n}`))
						: Zt(s)
				}
				default:
					return ut(`Unknown tool: ${t}`)
			}
		}
	},
	yW = class e {
		constructor(t, r, n, i, s, o, a, l) {
			this.rootAbsPath = t
			this.apiServer = r
			this.workspaceManager = n
			this.featureFlagManager = i
			this.logger = s
			this.orientationConcurrencyLevel = o
			this.progressTracker = a
			this.trace = l
			if (
				((this.localizationPrompt =
					this.featureFlagManager.currentFlags.memoriesParams.language_localization_prompt),
				!this.localizationPrompt)
			)
				throw (this.trace.setFlag(Cr.localizationPromptMissing), new Error("Localization prompt missing"))
			if (
				((this.detectLanguagesPrompt =
					this.featureFlagManager.currentFlags.memoriesParams.detect_languages_prompt),
				!this.detectLanguagesPrompt)
			)
				throw (
					(this.trace.setFlag(Cr.detectLanguagesPromptMissing), new Error("Detect languages prompt missing"))
				)
			if (
				((this.orientationCompressionPrompt =
					this.featureFlagManager.currentFlags.memoriesParams.orientation_compression_prompt),
				!this.orientationCompressionPrompt)
			)
				throw (
					(this.trace.setFlag(Cr.orientationCompressionPromptMissing),
					new Error("Orientation compression prompt missing"))
				)
			if (
				((this.orientationMaxLanguages =
					this.featureFlagManager.currentFlags.memoriesParams.orientation_max_languages),
				!this.orientationMaxLanguages)
			)
				throw (
					(this.trace.setFlag(Cr.orientationMaxLanguagesMissing),
					new Error("Orientation max languages missing"))
				)
			if (
				((this.buildTestQuery =
					this.featureFlagManager.currentFlags.memoriesParams.orientation_build_test_query),
				!this.buildTestQuery)
			)
				throw (this.trace.setFlag(Cr.orientationBuildTestQueryMissing), new Error("Build test prompt missing"))
			if (
				((this.modelName = this.featureFlagManager.currentFlags.memoriesParams.orientation_model_name),
				this.modelName === void 0)
			)
				throw (this.trace.setFlag(Cr.orientationModelNameMissing), new Error("Orientation model name missing"))
			this.modelName === "default" && (this.modelName = void 0),
				(this.queries = [{ name: "build-test", template: this.buildTestQuery }]),
				(this.tools = new mW(n, r, this.logger, a))
		}
		localizationPrompt
		detectLanguagesPrompt
		orientationCompressionPrompt
		orientationMaxLanguages
		modelName
		buildTestQuery
		tools
		queries
		static agentMdPattern = new RegExp("<agent_md>(?:\\s*```(?:\\w+)?\\n?)?(.*?)(?:```\\s*)?</agent_md>", "s")
		async appendToWorkspaceGuidelines(t) {
			let r = "[//]: # (AUGMENT-CODEBASE-ORIENTATION-RESULTS-START)",
				n = "[//]: # (AUGMENT-CODEBASE-ORIENTATION-RESULTS-END)",
				i = this.workspaceManager.getMostRecentlyChangedFolderRoot()
			if (!i) throw (this.trace.setFlag(Cr.noRootFolderFound), new Error("No root folder found"))
			let s = Sx.default.join(i, ".augment-guidelines"),
				o = ""
			try {
				Pn(s) && (o = await Fr(s))
			} catch (u) {
				this.trace.setFlag(Cr.failedToReadGuidelines),
					this.logger.error(`Failed to read existing guidelines: ${u}`)
			}
			let a = "",
				l = o.indexOf(r),
				c = o.indexOf(n)
			if (l !== -1 && c !== -1 && c > l) {
				let u = o.substring(0, l),
					f = o.substring(c + n.length)
				;(a =
					u +
					r +
					`
` +
					t +
					`
` +
					n +
					f),
					this.logger.debug("Replacing existing orientation results between markers")
			} else {
				let u =
					o.trim().length > 0
						? `

`
						: ""
				;(a =
					o.trim() +
					u +
					r +
					`
` +
					t +
					`
` +
					n),
					this.logger.debug("Appending new orientation results with markers")
			}
			try {
				await Gn.workspace.fs.writeFile(Gn.Uri.file(s), Buffer.from(a, "utf8")),
					this.logger.debug(`Successfully updated workspace guidelines at ${s}`)
			} catch (u) {
				throw (
					(this.trace.setFlag(Cr.failedToWriteGuidelines),
					new Error(`Failed to write workspace guidelines: ${u}`))
				)
			}
		}
		async run() {
			let { languages: t, allFiles: r } = await this.getTopProgrammingLanguages()
			if (Object.keys(t).length === 0) throw new Error("No programming languages detected")
			this.progressTracker.set(10)
			let n = await this.localizeLanguages(r, t)
			this.progressTracker.set(25)
			let i = (await Ame(".", this.workspaceManager))?.join(`
`)
			if (!i) throw (this.trace.setFlag(Cr.failedToListRootFolder), new Error("Failed to list root folder"))
			this.progressTracker.set(30)
			let s = (0, pW.default)(this.orientationConcurrencyLevel),
				o = Object.keys(t),
				l = 60 / o.length / this.queries.length
			this.trace.setFlag(Cr.agenticStarted)
			let c = o.map((C, v) =>
					s(async () => {
						this.logger.debug(`Processing language: ${C}`)
						let b = []
						for (let w of this.queries) {
							this.logger.debug(`Processing query: ${w.name}`)
							let B = w.template
									.replace(/{language}/g, C)
									.replace(/{rootFolderContent}/g, i)
									.replace(
										/{locationList}/g,
										n[C].split(",").join(`
`),
									),
								M = await this.doAgenticTurn(B, l, v)
							b.push(M), this.logger.debug(`Response language "${C}" and query "${w.name}": ${M}`)
						}
						return b
					}),
				),
				u = await Promise.all(c)
			this.trace.setFlag(Cr.agenticEnded)
			let f = u.flat().join(`

`)
			this.trace.setStringStats(Cr.agenticModelResponseStats, f), this.progressTracker.set(90)
			let p = this.apiServer.createRequestId()
			this.trace.setRequestId(Cr.compressionRequestId, p)
			let g = await this.simpleLlmCall(this.orientationCompressionPrompt.replace(/{assembledKnowledge}/g, f), p)
			this.trace.setStringStats(Cr.compressionModelResponseStats, g)
			let m = g.match(e.agentMdPattern)
			if (!m)
				throw (
					(this.trace.setFlag(Cr.compressionParsingFailed), new Error("Failed to parse compression response"))
				)
			let y = m[1].trim()
			this.logger.debug(`Compressed knowledge: ${y}`),
				this.progressTracker.set(95),
				this.trace.setFlag(Cr.rememberStarted),
				await this.appendToWorkspaceGuidelines(y),
				this.trace.setFlag(Cr.rememberEnded),
				this.progressTracker.set(100)
		}
		async doAgenticTurn(t, r, n) {
			let i = t,
				s = [],
				o = [],
				a = {
					request_message: i,
					response_text: "",
					request_id: this.apiServer.createRequestId(),
					request_nodes: [],
					response_nodes: [],
				},
				l,
				c = 30,
				u = 32,
				f = r / u,
				p = 0
			do {
				if ((this.trace.setNum(`agenticNumTurns_${n}`, p), p > c)) {
					if (p > u) throw new Error("Too many turns in agentic loop")
					s = [
						...s,
						{
							id: 2,
							type: $c.TEXT,
							text_node: {
								content: "You did too many turns already. Call `complete` tool immediately.",
							},
						},
					]
				}
				this.logger.debug(`Running agentic turn ${p}.`), this.progressTracker.inc(f)
				let g = this.apiServer.createRequestId(),
					m = await Kp(i, g, o, this.tools.getToolDefinitions(), s, Mn.agent)
				for await (let y of m)
					if (y.nodes) {
						let C = y.nodes.filter((v) => v.type === Jl.TOOL_USE || v.type === Jl.RAW_RESPONSE)
						;(a.response_nodes = a.response_nodes || []), a.response_nodes.push(...C)
					}
				if (((l = a.response_nodes?.find((y) => y.type === Jl.TOOL_USE)), l?.tool_use !== void 0)) {
					let y = l.tool_use,
						C = y.tool_name,
						v = JSON.parse(y.input_json)
					if ((this.logger.debug(`Calling tool: ${C}. Args: ${JSON.stringify(v)}`), C === "complete"))
						return (
							this.logger.debug(`Agentic turn complete. Took ${p} turns.`),
							this.progressTracker.inc(f * (u - p - 1)),
							this.trace.setStringStats(`agenticModelResponseStats_${n}`, v.response),
							v.response
						)
					let b = await this.tools.runTool(y.tool_name, v)
					;(s = [
						{
							id: 1,
							type: $c.TOOL_RESULT,
							tool_result_node: {
								tool_use_id: y.tool_use_id,
								content: b.text,
								is_error: b.isError,
							},
						},
					]),
						this.logger.debug(
							`Tool result: ${
								b.text.trim().split(`
`)[0]
							}...`,
						),
						(i = ""),
						o.push(a),
						(a = {
							request_message: "",
							response_text: "",
							request_id: this.apiServer.createRequestId(),
							request_nodes: s,
							response_nodes: [],
						})
				}
				p++
			} while (l?.tool_use !== void 0)
			throw (
				(this.trace.setFlag(`agenticFailedToComplete_${n}`), new Error("Agent didn't call the complete tool."))
			)
		}
		async localizeLanguages(t, r) {
			let n = {},
				i = (0, pW.default)(this.orientationConcurrencyLevel),
				o = 15 / Object.keys(r).length
			this.trace.setFlag(Cr.localizationStarted)
			let a = Object.entries(r).map(([c, u], f) =>
					i(async () => {
						this.logger.debug(`Localizing language: ${c} (index: ${f})`)
						let p = Aut(t, u)
						if (p.trim().length === 0) throw new Error(`Failed to render folder tree for ${c}`)
						let g = this.localizationPrompt
							.replace(/{programmingLanguage}/g, c)
							.replace(/{languageTree}/g, p)
						this.trace.setStringStats(`localizationPromptStats_${f}`, g)
						let m = this.apiServer.createRequestId()
						this.trace.setRequestId(`localizationRequestId_${f}`, m)
						let y = await this.simpleLlmCall(g, m)
						this.trace.setStringStats(`localizationResponseStats_${f}`, y)
						let C = y.match(/<locations>(.*?)<\/locations>/)
						if (!C)
							throw (
								(this.trace.setFlag(`localizationParsingFailed_${f}`),
								new Error(`Failed to extract locations from response: ${y}`))
							)
						return this.progressTracker.inc(o), { language: c, locations: C[1].trim() }
					}),
				),
				l = await Promise.all(a)
			return (
				this.trace.setFlag(Cr.localizationEnded),
				l.forEach(({ language: c, locations: u }, f) => {
					let p = u.split(",").length
					this.trace.setNum(`localizationNumLocations_${f}`, p), (n[c] = u)
				}),
				n
			)
		}
		async getTopProgrammingLanguages() {
			let t = new Set([
					"ad",
					"adown",
					"argdown",
					"argdn",
					"bicep",
					"c",
					"cpp",
					"cc",
					"cp",
					"cxx",
					"h",
					"hpp",
					"hxx",
					"cs",
					"ex",
					"elm",
					"erb",
					"rhtml",
					"gd",
					"godot",
					"tres",
					"tscn",
					"go",
					"haml",
					"hs",
					"hx",
					"html",
					"htm",
					"java",
					"js",
					"jsx",
					"kt",
					"ml",
					"mli",
					"mll",
					"mly",
					"php",
					"py",
					"r",
					"rb",
					"rs",
					"res",
					"resi",
					"sass",
					"scala",
					"styl",
					"swift",
					"tf",
					"tfvars",
					"ts",
					"tsx",
					"vue",
					"vala",
				]),
				r = {},
				n = [],
				i = async (p) => {
					let g = await Ex(p)
					if (g)
						for (let [m, y] of g) {
							if (m.startsWith(".")) continue
							let C = Sx.default.join(p, m)
							if (y === "Directory") await i(C)
							else if (y === "File") {
								let v = Sx.default.relative(this.rootAbsPath, C)
								n.push(v)
								let b = m.includes(".") ? m.split(".").pop().toLowerCase() : ""
								b && t.has(b) && (r[b] = (r[b] || 0) + 1)
							}
						}
				}
			await i(this.rootAbsPath), this.trace.setNum(Cr.topLanguagesNumFiles, n.length)
			let s = Object.entries(r)
					.sort(([, p], [, g]) => g - p)
					.slice(0, 20)
					.map(([p, g]) => `${p}: ${g}`).join(`
`),
				o = this.apiServer.createRequestId()
			this.trace.setRequestId(Cr.topLanguagesRequestId, o)
			let a = await this.simpleLlmCall(this.detectLanguagesPrompt.replace(/{fileExtensionsList}/g, s), o)
			this.trace.setStringStats(Cr.topLanguagesModelResponseStats, a),
				this.logger.debug(`Detected languages: "${a}"`)
			let l = JSON.parse(a.trim())
			this.trace.setNum(Cr.topLanguagesNumDetectedLanguages, Object.keys(l).length)
			let c = {}
			for (let [p, g] of Object.entries(l))
				(c[p] = g.reduce((m, y) => m + (r[y] || 0), 0)), this.logger.debug(`${p}: ${c[p]} files`)
			let u = Object.entries(c)
					.sort(([, p], [, g]) => g - p)
					.slice(0, this.orientationMaxLanguages)
					.map(([p]) => p),
				f = {}
			for (let p of u) f[p] = l[p]
			return (
				this.logger.debug(`Top ${this.orientationMaxLanguages} languages: ${JSON.stringify(f)}`),
				this.trace.setNum(Cr.topLanguagesNumFinalLanguages, Object.keys(f).length),
				{ languages: f, allFiles: n }
			)
		}
		async simpleLlmCall(t, r) {
			let n = await Kp(t, r, [], [], [], Mn.chat, this.modelName)
			for await (let i of n)
				if (i.nodes) {
					for (let s of i.nodes) if (s.type === Jl.RAW_RESPONSE) return s.content
				}
			throw new Error("No response from model")
		}
	}