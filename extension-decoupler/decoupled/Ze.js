
	var km = {
			type: [
				"",
				"no-referrer",
				"no-referrer-when-downgrade",
				"same-origin",
				"origin",
				"strict-origin",
				"origin-when-cross-origin",
				"strict-origin-when-cross-origin",
				"unsafe-url",
			],
			missing: "",
		},
		HPe = {
			A: !0,
			LINK: !0,
			BUTTON: !0,
			INPUT: !0,
			SELECT: !0,
			TEXTAREA: !0,
			COMMAND: !0,
		},
		tc = function (e, t, r) {
			ze.call(this, e, t, r), (this._form = null)
		},
		ze = (wS.HTMLElement = Me({
			superclass: Gz,
			name: "HTMLElement",
			ctor: function (t, r, n) {
				Gz.call(this, t, r, ha.NAMESPACE.HTML, n)
			},
			props: {
				dangerouslySetInnerHTML: {
					set: function (e) {
						this._innerHTML = e
					},
				},
				innerHTML: {
					get: function () {
						return this.serialize()
					},
					set: function (e) {
						var t = this.ownerDocument.implementation.mozHTMLParser(this.ownerDocument._address, this)
						t.parse(e === null ? "" : String(e), !0)
						for (var r = this instanceof oE.template ? this.content : this; r.hasChildNodes(); )
							r.removeChild(r.firstChild)
						r.appendChild(t._asDocumentFragment())
					},
				},
				style: {
					get: function () {
						return this._style || (this._style = new qPe(this)), this._style
					},
					set: function (e) {
						e == null && (e = ""), this._setattr("style", String(e))
					},
				},
				blur: { value: function () {} },
				focus: { value: function () {} },
				forceSpellCheck: { value: function () {} },
				click: {
					value: function () {
						if (!this._click_in_progress) {
							this._click_in_progress = !0
							try {
								this._pre_click_activation_steps && this._pre_click_activation_steps()
								var e = this.ownerDocument.createEvent("MouseEvent")
								e.initMouseEvent(
									"click",
									!0,
									!0,
									this.ownerDocument.defaultView,
									1,
									0,
									0,
									0,
									0,
									!1,
									!1,
									!1,
									!1,
									0,
									null,
								)
								var t = this.dispatchEvent(e)
								t
									? this._post_click_activation_steps && this._post_click_activation_steps(e)
									: this._cancelled_activation_steps && this._cancelled_activation_steps()
							} finally {
								this._click_in_progress = !1
							}
						}
					},
				},
				submit: { value: ha.nyi },
			},
			attributes: {
				title: String,
				lang: String,
				dir: { type: ["ltr", "rtl", "auto"], missing: "" },
				draggable: { type: ["true", "false"], treatNullAsEmptyString: !0 },
				spellcheck: { type: ["true", "false"], missing: "" },
				enterKeyHint: {
					type: ["enter", "done", "go", "next", "previous", "search", "send"],
					missing: "",
				},
				autoCapitalize: {
					type: ["off", "on", "none", "sentences", "words", "characters"],
					missing: "",
				},
				autoFocus: Boolean,
				accessKey: String,
				nonce: String,
				hidden: Boolean,
				translate: { type: ["no", "yes"], missing: "" },
				tabIndex: {
					type: "long",
					default: function () {
						return this.tagName in HPe || this.contentEditable ? 0 : -1
					},
				},
			},
			events: [
				"abort",
				"canplay",
				"canplaythrough",
				"change",
				"click",
				"contextmenu",
				"cuechange",
				"dblclick",
				"drag",
				"dragend",
				"dragenter",
				"dragleave",
				"dragover",
				"dragstart",
				"drop",
				"durationchange",
				"emptied",
				"ended",
				"input",
				"invalid",
				"keydown",
				"keypress",
				"keyup",
				"loadeddata",
				"loadedmetadata",
				"loadstart",
				"mousedown",
				"mousemove",
				"mouseout",
				"mouseover",
				"mouseup",
				"mousewheel",
				"pause",
				"play",
				"playing",
				"progress",
				"ratechange",
				"readystatechange",
				"reset",
				"seeked",
				"seeking",
				"select",
				"show",
				"stalled",
				"submit",
				"suspend",
				"timeupdate",
				"volumechange",
				"waiting",
				"blur",
				"error",
				"focus",
				"load",
				"scroll",
			],
		})),
		WPe = Me({
			name: "HTMLUnknownElement",
			ctor: function (t, r, n) {
				ze.call(this, t, r, n)
			},
		}),
		rc = {
			form: {
				get: function () {
					return this._form
				},
			},
		}