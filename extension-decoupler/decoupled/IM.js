
var iM = class extends z {
		constructor(r) {
			super()
			this._config = r
			;(this._logger = X("CommandManager")),
				this.addDisposable(
					new sM.Disposable(() => {
						this._commands.forEach((n, i) => {
							n.unregister(), this._commands.delete(i)
						})
					}),
				),
				this.addDisposable(
					this._config.onDidChange(() => {
						this.register(this.allCommands)
					}),
				)
		}
		_commands = new Map()
		_groups = []
		_logger
		register(r) {
			for (let n of r) {
				if (this._commands.has(n.commandID)) {
					this._commands.get(n.commandID)?.update(this._config)
					continue
				}
				n.register(this._config), this._commands.set(n.commandID, n)
			}
		}
		registerGroup(r, n) {
			this._logger.debug(`Registering group '${r}' with ${n.length} commands.`),
				this._groups.push({ name: r, commands: n }),
				this.register(n)
		}
		get availableCommands() {
			return Array.from(this._commands.values()).filter((r) => r.isRegistered && r.canRun())
		}
		get availableCommandGroups() {
			let r = []
			for (let n = 0; n < this._groups.length; n++) {
				let { name: i, commands: s } = this._groups[n],
					o = s.filter((a) => a.isRegistered && a.canRun())
				o.length !== 0 &&
					(r.length > 0 && r[r.length - 1].name === i
						? r[r.length - 1].commands.push(...o)
						: r.push({ name: i, commands: o }))
			}
			return r
		}
		get allCommands() {
			return Array.from(this._commands.values())
		}
	},
	lt = class extends z {
		constructor(r = void 0, n = !0) {
			super()
			this._title = r
			this._showInActionPanel = n
			let i = this.constructor
			typeof i.commandID == "string" && (this._commandID = i.commandID),
				this.addDisposable({ dispose: () => this.unregister() })
		}
		_registration
		_logger = X("AugmentCommand")
		static commandID
		_commandID
		get commandID() {
			return (
				(0, cCe.default)(
					typeof this._commandID == "string",
					`commandID must be defined on subclass ${this.constructor.name}`,
				),
				this._commandID
			)
		}
		get title() {
			if (typeof this._title == "string") return this._title
			if (typeof this._title == "function") return this._title()
		}
		get showInActionPanel() {
			return this._showInActionPanel
		}
		get isRegistered() {
			return this._registration !== void 0
		}
		canRun() {
			return !0
		}
		register(r) {
			this._registration === void 0 &&
				((this.type === "debug" && !r.config.enableDebugFeatures) ||
					(this._registration = sM.commands.registerCommand(this.commandID, (...n) => {
						if (!this.canRun()) {
							this._logger.debug(`Not running '${this.commandID}' command with type ${this.type}.`)
							return
						}
						this.run(...n)
					})))
		}
		update(r) {
			this.type === "debug" && (r.config.enableDebugFeatures ? this.register(r) : this.dispose())
		}
		unregister() {
			this._registration?.dispose(), (this._registration = void 0)
		}
	}