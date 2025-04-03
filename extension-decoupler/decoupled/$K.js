
var Gk = class extends z {
		constructor(r, n, i) {
			super()
			this._shellName = r
			this._extensionRoot = n
			this._agentSessionEventReporter = i
			let s = yi.window
			s.onDidEndTerminalShellExecution && Ko("1.93.0")
				? ((this._hasShellIntegration = !0),
					(this._shellExecutionListener = s.onDidEndTerminalShellExecution(async (o) => {
						for (let [a, l] of Array.from(this._processes).reverse())
							if (
								l.terminal === o.terminal &&
								o.execution.commandLine.value === l.command &&
								!l.killed &&
								l.exitCode === null
							) {
								if (((l.exitCode = o.exitCode ?? null), l.readStream)) {
									await Kl(1), this._logger.debug(`Reading exact output for process ${a}`)
									let u = ""
									for await (let f of l.readStream) u += f
									this._isBuggyOutput(u)
										? (this._logger.debug(
												`Buggy output detected for process ${a}. Please upgrade VSCode.`,
											),
											this._agentSessionEventReporter.reportEvent({
												eventName: Is.vsCodeTerminalBuggyOutput,
												conversationId: "",
											}),
											(l.output = await this._getOutputFromClipboard(a)))
										: (l.output = this._stripControlCodes($I(u, this._maxOutputLength)))
								} else l.output = await this._getOutputFromClipboard(a)
								l.terminal !== this._longRunningTerminal && l.terminal.dispose(), (l.killed = !0)
								let c = this._waitResolvers.get(a)
								c && c({ output: l.output, returnCode: l.exitCode })
								break
							}
					})))
				: this._agentSessionEventReporter.reportEvent({
						eventName: Is.vsCodeTerminalShellIntegrationNotAvailable,
						conversationId: "",
					}),
				this.addDisposable(
					yi.window.onDidCloseTerminal(async (o) => {
						for (let [a, l] of this._processes)
							if (l.terminal === o) {
								l.readStream && (l.output = await this._getOutputFromPossiblyIncompleteProcess(l, a)),
									(l.killed = !0),
									(l.exitCode = o.exitStatus?.code ?? -1)
								let c = this._waitResolvers.get(a)
								c && c({ output: l.output, returnCode: l.exitCode })
								break
							}
					}),
				)
		}
		_processes = new Map()
		_waitResolvers = new Map()
		_nextId = 1
		_shellExecutionListener
		_longRunningTerminal
		_hasShellIntegration = !1
		_logger = X("TerminalProcessTools")
		_maxOutputLength = 64 * 1024
		async launch(r, n, i, s) {
			let o = this._nextId++,
				a
			if (
				(s
					? ((!this._longRunningTerminal || this._longRunningTerminal.exitStatus) &&
							(this._longRunningTerminal = this._createTerminal("Augment", n)),
						(a = this._longRunningTerminal))
					: (a = this._createTerminal(`Augment - ${r}`, n)),
				s &&
					Array.from(this._processes.values()).some(
						(c) => c.terminal === a && c.exitCode === null && !c.killed,
					))
			)
				return `Cannot launch another waiting process while another waiting process is running. The id of the existing waiting process is ${o}.
Please wait until this process is complete (you can use a tool for this purpose), or launch the new process as a background process with \`wait=false\`.`
			if (
				(a.show(),
				(this._shellName === "bash" || this._shellName === "powershell") &&
					a === this._longRunningTerminal &&
					(await this._getLastCommand()) === r)
			) {
				let c = this._shellName === "bash" ? ":" : "#"
				this._hasShellIntegration && a.shellIntegration ? a.shellIntegration.executeCommand(c) : a.sendText(c)
				let u = null,
					f = !1
				await yx(
					new Promise((p) => {
						u = setInterval(() => {
							f ||
								((f = !0),
								(async () => {
									try {
										;(await this._getLastCommand()) === c &&
											(u && (clearInterval(u), (u = null)),
											this._logger.debug("Successfully got noop command result."),
											p(void 0))
									} finally {
										f = !1
									}
								})())
						}, 100)
					}),
					1e3,
				)
					.catch(() => {
						this._logger.debug("Timed out waiting for noop command to complete"),
							this._agentSessionEventReporter.reportEvent({
								eventName: Is.vsCodeTerminalTimedOutWaitingForNoopCommand,
								conversationId: "",
							})
					})
					.finally(() => {
						u && (clearInterval(u), (u = null))
					})
			}
			let l = {
				terminal: a,
				command: r,
				lastCommand: await this._getLastCommand(),
				output: "",
				killed: !1,
				readStream: void 0,
				exitCode: null,
			}
			if ((this._processes.set(o, l), this._hasShellIntegration && a.shellIntegration)) {
				let c = a.shellIntegration.executeCommand(r)
				;(l.readStream = c.read()), this._logger.debug(`Using existing shell integration for command: ${r}`)
			} else if (this._hasShellIntegration && yi.window.onDidChangeTerminalShellIntegration) {
				let c
				;(c = yi.window.onDidChangeTerminalShellIntegration((u) => {
					if (u.terminal === a && u.shellIntegration && !l.readStream) {
						let f = u.shellIntegration.executeCommand(r)
						;(l.readStream = f.read()),
							this._logger.debug(`Using shell integration for command: ${r}`),
							c && (c.dispose(), (c = void 0))
					}
				})),
					setTimeout(() => {
						l.readStream ||
							(a.sendText(r),
							this._logger.debug(`Failed to use shell integration for command: ${r}`),
							this._agentSessionEventReporter.reportEvent({
								eventName: Is.vsCodeTerminalFailedToUseShellIntegration,
								conversationId: "",
							})),
							c && (c.dispose(), (c = void 0))
					}, 2e3)
			} else this._logger.debug(`Not using shell integration for command: ${r}`), a.sendText(r)
			return (
				i.addEventListener("abort", () => {
					this.kill(o)
				}),
				o
			)
		}
		_createTerminal(r, n) {
			let i = this._shellName === "bash" ? { PAGER: "cat", LESS: "-FX", GIT_PAGER: "cat" } : void 0
			return yi.window.createTerminal({
				name: r,
				shellPath: this._shellName,
				cwd: n,
				env: i,
				iconPath: {
					light: yi.Uri.joinPath(this._extensionRoot, "media", "panel-icon-light.svg"),
					dark: yi.Uri.joinPath(this._extensionRoot, "media", "panel-icon-dark.svg"),
				},
				isTransient: !0,
			})
		}
		async kill(r) {
			let n = this._processes.get(r)
			if (!(!n || n.killed))
				return (
					n.terminal === this._longRunningTerminal ? n.terminal.sendText("", !1) : n.terminal.dispose(),
					(n.killed = !0),
					(n.exitCode = -1),
					(n.output = await this._getOutputFromPossiblyIncompleteProcess(n, r)),
					n.output
				)
		}
		isInLongRunningTerminal(r) {
			let n = this._processes.get(r)
			return !!n && n.terminal === this._longRunningTerminal
		}
		async readOutput(r) {
			let n = this._processes.get(r)
			return n
				? n.exitCode !== null
					? { output: n.output, returnCode: n.exitCode }
					: (n.terminal.show(),
						{
							output: await this._getOutputFromPossiblyIncompleteProcess(n, r),
							returnCode: n.exitCode,
						})
				: void 0
		}
		writeInput(r, n) {
			let i = this._processes.get(r)
			return !i || i.killed ? !1 : (i.terminal.sendText(n), !0)
		}
		listProcesses() {
			let r = []
			for (let [n, i] of this._processes.entries()) {
				let s = i.killed ? "killed" : "running"
				r.push({ id: n, command: i.command, state: s, returnCode: i.exitCode })
			}
			return r
		}
		waitForProcess(r, n, i) {
			return new Promise((s) => {
				;(async () => {
					let o = this._processes.get(r)
					if (!o) {
						s({ output: "", returnCode: null })
						return
					}
					if (o.exitCode !== null) {
						s({ output: o.output, returnCode: o.exitCode })
						return
					}
					let a = setTimeout(
							() => {
								this._waitResolvers.delete(r),
									this.readOutput(r).then((u) => {
										s({ output: u?.output ?? "", returnCode: null })
									})
							},
							n !== void 0 ? n * 1e3 : 999999,
						),
						l
					if (o.lastCommand === o.command) {
						this._logger.debug("Last command is the same as the current one."),
							this._agentSessionEventReporter.reportEvent({
								eventName: Is.vsCodeTerminalLastCommandIsSameAsCurrent,
								conversationId: "",
							})
						let u = await this.readOutput(r)
						u
							? s(u)
							: (this._logger.debug(`Failed to read output for process ${r}`),
								this._agentSessionEventReporter.reportEvent({
									eventName: Is.vsCodeTerminalFailedToReadOutput,
									conversationId: "",
								}),
								s({ output: "", returnCode: null }))
					} else
						(l = setInterval(() => {
							;(async () => {
								if ((await this._getLastCommand()) === o.command) {
									this._logger.debug(`Polling determined process ${r} is done.`),
										this._agentSessionEventReporter.reportEvent({
											eventName: Is.vsCodeTerminalPollingDeterminedProcessIsDone,
											conversationId: "",
										}),
										clearInterval(l)
									let f = await this.readOutput(r)
									;(o.output = f?.output ?? ""),
										(o.exitCode = f?.returnCode ?? null),
										(o.killed = !0),
										f
											? s(f)
											: (this._logger.debug(`Failed to read output for process ${r}`),
												this._agentSessionEventReporter.reportEvent({
													eventName: Is.vsCodeTerminalFailedToReadOutput,
													conversationId: "",
												}),
												s({ output: "", returnCode: null }))
								}
							})()
						}, 1e3)),
							this._waitResolvers.set(r, (u) => {
								clearTimeout(a), clearInterval(l), this._waitResolvers.delete(r), s(u)
							})
					let c = () => {
						clearTimeout(a),
							clearInterval(l),
							this._waitResolvers.delete(r),
							s({ output: "", returnCode: null })
					}
					i.addEventListener("abort", c)
				})()
			})
		}
		async _getOutputFromPossiblyIncompleteProcess(r, n) {
			if (r.readStream) {
				this._logger.debug(`Reading exact intermediate output for process ${n}`)
				let i = ""
				try {
					let s = async (l) => {
							let c = new Promise((u) => {
								setTimeout(() => u({ done: !0, value: void 0 }), 100)
							})
							return Promise.race([l.next(), c])
						},
						o = r.readStream[Symbol.asyncIterator](),
						a = await s(o)
					for (; !a.done; ) a.value !== void 0 && (i += a.value), (a = await s(o))
				} catch (s) {
					this._logger.debug(`Error reading stream for process ${n}: ${s.message ?? ""}`),
						this._agentSessionEventReporter.reportEvent({
							eventName: Is.vsCodeTerminalFailedToReadOutput,
							conversationId: "",
						})
				}
				return this._stripControlCodes($I(i, this._maxOutputLength))
			} else return await this._getOutputFromClipboard(n)
		}
		async _getOutputFromClipboard(r) {
			this._logger.debug(`Reading approximate output for process ${r}`),
				this._agentSessionEventReporter.reportEvent({
					eventName: Is.vsCodeTerminalReadingApproximateOutput,
					conversationId: "",
				})
			let n = await yi.env.clipboard.readText()
			await yi.env.clipboard.writeText(""),
				await yi.commands.executeCommand("workbench.action.terminal.copyLastCommandOutput")
			let i = await yi.env.clipboard.readText()
			return await yi.env.clipboard.writeText(n), $I(i, this._maxOutputLength)
		}
		async _getLastCommand() {
			let r = await yi.env.clipboard.readText()
			await yi.env.clipboard.writeText(""),
				await yi.commands.executeCommand("workbench.action.terminal.copyLastCommand")
			let n = await yi.env.clipboard.readText()
			return await yi.env.clipboard.writeText(r), n
		}
		closeAllProcesses() {
			for (let r of this._processes.values())
				!r.killed && r.terminal !== this._longRunningTerminal && r.terminal.dispose()
			this._processes.clear(),
				this._longRunningTerminal && (this._longRunningTerminal.dispose(), (this._longRunningTerminal = void 0))
		}
		cleanup() {
			this.closeAllProcesses(),
				this._shellExecutionListener &&
					(this._shellExecutionListener.dispose(), (this._shellExecutionListener = void 0)),
				this.dispose()
		}
		getLongRunningTerminalInfo() {
			if (!(!this._hasShellIntegration || !this._longRunningTerminal))
				return {
					terminal_id: 0,
					current_working_directory: this._longRunningTerminal.shellIntegration?.cwd?.fsPath,
				}
		}
		_stripControlCodes(r) {
			return r
				.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
				.replace(/(?:\x1b\])?(\d+;[^\x07\x1b]*(?:\x07|\x1b\\))/g, "")
		}
		_isBuggyOutput(r) {
			return !Ko("1.98.0") && !r.includes("\x1B]633;D") && !r.includes("\x1B]133;D")
		}
	},
	/**
	 * Ny class extends the rn class and is responsible for launching a new process 
	 * with a shell command. It can handle both waiting and non-waiting processes 
	 * based on the provided parameters. This class interacts with the process tools 
	 * to manage the execution of shell commands and provides a structured way to 
	 * handle the command's output and status.
	 */
	Ny = class e extends rn {
		constructor(r, n, i, s) {
			super(On.launchProcess, n().shellCommandsAlwaysSafe ? xt.Safe : xt.Check)
			this._workspaceManager = r
			this._getAgentConfig = n
			this.processTools = i
			this._shellName = s
			this._allowlist = ym(process.platform, this._shellName)
		}
		static defaultWaitSeconds = 60
		_allowlist
		version = 2
		get description() {
			return `Launch a new process with a shell command. A process can be waiting (\`wait=true\`) or non-waiting (\`wait=false\`, which is default).

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

The OS is ${process.platform}. The shell is '${this._shellName}'.`
		}
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				command: {
					type: "string",
					description: "The shell command to execute.",
				},
				wait: {
					type: "boolean",
					description: "Optional: whether to wait for the command to complete (default false).",
				},
				wait_seconds: {
					type: "number",
					description: `Optional: number of seconds to wait for the command to complete (default is ${e.defaultWaitSeconds}). Only relevant when wait=true.`,
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
				let s = r.wait,
					o = r.wait_seconds
				if (s === void 0 && o !== void 0) return ut("wait_seconds is specified but wait is not.")
				let a = r.cwd ?? Kd(this._workspaceManager),
					l = !!s,
					c = await this.processTools.launch(r.command, a, i, l)
				if (typeof c == "string") return ut(c)
				if (!s) return Zt(`Process launched with terminal ID ${c}`)
				let u = await this.processTools.waitForProcess(c, o ?? e.defaultWaitSeconds, i),
					f = iCe(c, this.processTools, this._workspaceManager)
				return u.returnCode === null
					? Zt(`Command may still be running. You can use read_process to get more output
and kill_process to terminate it if needed.
Terminal ID ${c}
Output so far:
<output>
${u.output}
</output>
${f}`)
					: {
							text: `Here are the results from executing the command.
<return-code>
${u.returnCode}
</return-code>
<output>
${u.output}
</output>
${f}`,
							isError: u.returnCode !== 0,
						}
			} catch (s) {
				return ut(`Failed to launch process: ${s.message ?? ""}`)
			}
		}
	},
	/**
	 * $k class extends the rn class and provides functionality to kill a process
	 * by its terminal ID. This class is part of a command execution framework that
	 * interacts with terminal processes.
	 * 
	 * The constructor initializes the class with the process tools required to 
	 * manage terminal processes. It sets up a description for the command and 
	 * defines the input schema for the expected parameters.
	 * 
	 * The `checkToolCallSafe` method ensures that the tool can be called safely 
	 * without any additional checks.
	 * 
	 * The `call` method takes the input parameters, retrieves the terminal ID, 
	 * and attempts to kill the specified terminal process. It returns a success 
	 * message if the terminal is killed or an error message if the terminal is 
	 * not found.
	 */
	$k = class extends rn {
		constructor(r) {
			super(On.killProcess, xt.Safe)
			this._processTools = r
		}
		description = "Kill a process by its terminal ID."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				terminal_id: { type: "integer", description: "Terminal ID to kill." },
			},
			required: ["terminal_id"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		async call(r, n, i) {
			let s = r.terminal_id,
				o = await this._processTools.kill(s)
			return o
				? Zt(`Terminal ${s} killed
<output>${o}</output>`)
				: ut(`Terminal ${s} not found`)
		}
	},
	Yk = class extends rn {
		constructor(r, n) {
			super(On.readProcess, xt.Safe)
			this._processTools = r
			this._workspaceManager = n
		}
		description = "Read output from a terminal."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				terminal_id: {
					type: "integer",
					description: "Terminal ID to read from.",
				},
			},
			required: ["terminal_id"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		async call(r, n, i) {
			let s = r.terminal_id,
				o = await this._processTools.readOutput(s)
			if (!o) return ut(`Terminal ${s} not found`)
			let a = iCe(s, this._processTools, this._workspaceManager),
				l = o.returnCode !== null ? "completed" : "still running",
				c = `Here is the output from terminal ${s} (status: ${l}):
<output>${o.output}</output>
`
			return (
				o.returnCode !== null &&
					(c += `<return-code>
${o.returnCode}
</return-code>
`),
				a && (c += a),
				Zt(c)
			)
		}
	},
	Kk = class extends rn {
		constructor(r) {
			super(On.writeProcess, xt.Safe)
			this._processTools = r
		}
		description = "Write input to a terminal."
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: {
				terminal_id: {
					type: "integer",
					description: "Terminal ID to write to.",
				},
				input_text: {
					type: "string",
					description: "Text to write to the process's stdin.",
				},
			},
			required: ["terminal_id", "input_text"],
		})
		checkToolCallSafe(r) {
			return !0
		}
		call(r, n, i) {
			let s = r.terminal_id,
				o = r.input_text
			return this._processTools.writeInput(s, o)
				? Promise.resolve(Zt(`Input written to terminal ${s}`))
				: Promise.resolve(ut(`Terminal ${s} not found or write failed`))
		}
	},
	Jk = class extends rn {
		constructor(r) {
			super(On.listProcesses, xt.Safe)
			this._processTools = r
		}
		description = "List all known terminals and their states."
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
					`Terminal ${a.id}: ${a.command} - ${l}`
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
	zk = class extends rn {
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