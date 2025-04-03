
var s7 = x((Rxt, i7) => {
	"use strict"
	function HLe(e) {
		for (var t = 1; t < arguments.length; t++) {
			var r = arguments[t]
			for (var n in r) r.hasOwnProperty(n) && (e[n] = r[n])
		}
		return e
	}
	function pU(e, t) {
		return Array(t + 1).join(e)
	}
	function WLe(e) {
		return e.replace(/^\n*/, "")
	}
	function GLe(e) {
		for (
			var t = e.length;
			t > 0 &&
			e[t - 1] ===
				`
`;

		)
			t--
		return e.substring(0, t)
	}
	var $Le = [
		"ADDRESS",
		"ARTICLE",
		"ASIDE",
		"AUDIO",
		"BLOCKQUOTE",
		"BODY",
		"CANVAS",
		"CENTER",
		"DD",
		"DIR",
		"DIV",
		"DL",
		"DT",
		"FIELDSET",
		"FIGCAPTION",
		"FIGURE",
		"FOOTER",
		"FORM",
		"FRAMESET",
		"H1",
		"H2",
		"H3",
		"H4",
		"H5",
		"H6",
		"HEADER",
		"HGROUP",
		"HR",
		"HTML",
		"ISINDEX",
		"LI",
		"MAIN",
		"MENU",
		"NAV",
		"NOFRAMES",
		"NOSCRIPT",
		"OL",
		"OUTPUT",
		"P",
		"PRE",
		"SECTION",
		"TABLE",
		"TBODY",
		"TD",
		"TFOOT",
		"TH",
		"THEAD",
		"TR",
		"UL",
	]
	function AU(e) {
		return mU(e, $Le)
	}
	var zj = [
		"AREA",
		"BASE",
		"BR",
		"COL",
		"COMMAND",
		"EMBED",
		"HR",
		"IMG",
		"INPUT",
		"KEYGEN",
		"LINK",
		"META",
		"PARAM",
		"SOURCE",
		"TRACK",
		"WBR",
	]
	function jj(e) {
		return mU(e, zj)
	}
	function YLe(e) {
		return Xj(e, zj)
	}
	var Zj = ["A", "TABLE", "THEAD", "TBODY", "TFOOT", "TH", "TD", "IFRAME", "SCRIPT", "AUDIO", "VIDEO"]
	function KLe(e) {
		return mU(e, Zj)
	}
	function JLe(e) {
		return Xj(e, Zj)
	}
	function mU(e, t) {
		return t.indexOf(e.nodeName) >= 0
	}
	function Xj(e, t) {
		return (
			e.getElementsByTagName &&
			t.some(function (r) {
				return e.getElementsByTagName(r).length
			})
		)
	}
	var Us = {}
	Us.paragraph = {
		filter: "p",
		replacement: function (e) {
			return (
				`

` +
				e +
				`

`
			)
		},
	}
	Us.lineBreak = {
		filter: "br",
		replacement: function (e, t, r) {
			return (
				r.br +
				`
`
			)
		},
	}
	Us.heading = {
		filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
		replacement: function (e, t, r) {
			var n = Number(t.nodeName.charAt(1))
			if (r.headingStyle === "setext" && n < 3) {
				var i = pU(n === 1 ? "=" : "-", e.length)
				return (
					`

` +
					e +
					`
` +
					i +
					`

`
				)
			} else
				return (
					`

` +
					pU("#", n) +
					" " +
					e +
					`

`
				)
		},
	}
	Us.blockquote = {
		filter: "blockquote",
		replacement: function (e) {
			return (
				(e = e.replace(/^\n+|\n+$/g, "")),
				(e = e.replace(/^/gm, "> ")),
				`

` +
					e +
					`

`
			)
		},
	}
	Us.list = {
		filter: ["ul", "ol"],
		replacement: function (e, t) {
			var r = t.parentNode
			return r.nodeName === "LI" && r.lastElementChild === t
				? `
` + e
				: `

` +
						e +
						`

`
		},
	}
	Us.listItem = {
		filter: "li",
		replacement: function (e, t, r) {
			e = e
				.replace(/^\n+/, "")
				.replace(
					/\n+$/,
					`
`,
				)
				.replace(
					/\n/gm,
					`
    `,
				)
			var n = r.bulletListMarker + "   ",
				i = t.parentNode
			if (i.nodeName === "OL") {
				var s = i.getAttribute("start"),
					o = Array.prototype.indexOf.call(i.children, t)
				n = (s ? Number(s) + o : o + 1) + ".  "
			}
			return (
				n +
				e +
				(t.nextSibling && !/\n$/.test(e)
					? `
`
					: "")
			)
		},
	}
	Us.indentedCodeBlock = {
		filter: function (e, t) {
			return (
				t.codeBlockStyle === "indented" &&
				e.nodeName === "PRE" &&
				e.firstChild &&
				e.firstChild.nodeName === "CODE"
			)
		},
		replacement: function (e, t, r) {
			return (
				`

    ` +
				t.firstChild.textContent.replace(
					/\n/g,
					`
    `,
				) +
				`

`
			)
		},
	}
	Us.fencedCodeBlock = {
		filter: function (e, t) {
			return (
				t.codeBlockStyle === "fenced" &&
				e.nodeName === "PRE" &&
				e.firstChild &&
				e.firstChild.nodeName === "CODE"
			)
		},
		replacement: function (e, t, r) {
			for (
				var n = t.firstChild.getAttribute("class") || "",
					i = (n.match(/language-(\S+)/) || [null, ""])[1],
					s = t.firstChild.textContent,
					o = r.fence.charAt(0),
					a = 3,
					l = new RegExp("^" + o + "{3,}", "gm"),
					c;
				(c = l.exec(s));

			)
				c[0].length >= a && (a = c[0].length + 1)
			var u = pU(o, a)
			return (
				`

` +
				u +
				i +
				`
` +
				s.replace(/\n$/, "") +
				`
` +
				u +
				`

`
			)
		},
	}
	Us.horizontalRule = {
		filter: "hr",
		replacement: function (e, t, r) {
			return (
				`

` +
				r.hr +
				`

`
			)
		},
	}
	Us.inlineLink = {
		filter: function (e, t) {
			return t.linkStyle === "inlined" && e.nodeName === "A" && e.getAttribute("href")
		},
		replacement: function (e, t) {
			var r = t.getAttribute("href")
			r && (r = r.replace(/([()])/g, "\\$1"))
			var n = qS(t.getAttribute("title"))
			return n && (n = ' "' + n.replace(/"/g, '\\"') + '"'), "[" + e + "](" + r + n + ")"
		},
	}
	Us.referenceLink = {
		filter: function (e, t) {
			return t.linkStyle === "referenced" && e.nodeName === "A" && e.getAttribute("href")
		},
		replacement: function (e, t, r) {
			var n = t.getAttribute("href"),
				i = qS(t.getAttribute("title"))
			i && (i = ' "' + i + '"')
			var s, o
			switch (r.linkReferenceStyle) {
				case "collapsed":
					;(s = "[" + e + "][]"), (o = "[" + e + "]: " + n + i)
					break
				case "shortcut":
					;(s = "[" + e + "]"), (o = "[" + e + "]: " + n + i)
					break
				default:
					var a = this.references.length + 1
					;(s = "[" + e + "][" + a + "]"), (o = "[" + a + "]: " + n + i)
			}
			return this.references.push(o), s
		},
		references: [],
		append: function (e) {
			var t = ""
			return (
				this.references.length &&
					((t =
						`

` +
						this.references.join(`
`) +
						`

`),
					(this.references = [])),
				t
			)
		},
	}
	Us.emphasis = {
		filter: ["em", "i"],
		replacement: function (e, t, r) {
			return e.trim() ? r.emDelimiter + e + r.emDelimiter : ""
		},
	}
	Us.strong = {
		filter: ["strong", "b"],
		replacement: function (e, t, r) {
			return e.trim() ? r.strongDelimiter + e + r.strongDelimiter : ""
		},
	}
	Us.code = {
		filter: function (e) {
			var t = e.previousSibling || e.nextSibling,
				r = e.parentNode.nodeName === "PRE" && !t
			return e.nodeName === "CODE" && !r
		},
		replacement: function (e) {
			if (!e) return ""
			e = e.replace(/\r?\n|\r/g, " ")
			for (
				var t = /^`|^ .*?[^ ].* $|`$/.test(e) ? " " : "", r = "`", n = e.match(/`+/gm) || [];
				n.indexOf(r) !== -1;

			)
				r = r + "`"
			return r + t + e + t + r
		},
	}
	Us.image = {
		filter: "img",
		replacement: function (e, t) {
			var r = qS(t.getAttribute("alt")),
				n = t.getAttribute("src") || "",
				i = qS(t.getAttribute("title")),
				s = i ? ' "' + i + '"' : ""
			return n ? "![" + r + "](" + n + s + ")" : ""
		},
	}
	function qS(e) {
		return e
			? e.replace(
					/(\n+\s*)+/g,
					`
`,
				)
			: ""
	}
	function e7(e) {
		;(this.options = e),
			(this._keep = []),
			(this._remove = []),
			(this.blankRule = { replacement: e.blankReplacement }),
			(this.keepReplacement = e.keepReplacement),
			(this.defaultRule = { replacement: e.defaultReplacement }),
			(this.array = [])
		for (var t in e.rules) this.array.push(e.rules[t])
	}
	e7.prototype = {
		add: function (e, t) {
			this.array.unshift(t)
		},
		keep: function (e) {
			this._keep.unshift({ filter: e, replacement: this.keepReplacement })
		},
		remove: function (e) {
			this._remove.unshift({
				filter: e,
				replacement: function () {
					return ""
				},
			})
		},
		forNode: function (e) {
			if (e.isBlank) return this.blankRule
			var t
			return (t = fU(this.array, e, this.options)) ||
				(t = fU(this._keep, e, this.options)) ||
				(t = fU(this._remove, e, this.options))
				? t
				: this.defaultRule
		},
		forEach: function (e) {
			for (var t = 0; t < this.array.length; t++) e(this.array[t], t)
		},
	}
	function fU(e, t, r) {
		for (var n = 0; n < e.length; n++) {
			var i = e[n]
			if (zLe(i, t, r)) return i
		}
	}
	function zLe(e, t, r) {
		var n = e.filter
		if (typeof n == "string") {
			if (n === t.nodeName.toLowerCase()) return !0
		} else if (Array.isArray(n)) {
			if (n.indexOf(t.nodeName.toLowerCase()) > -1) return !0
		} else if (typeof n == "function") {
			if (n.call(e, t, r)) return !0
		} else throw new TypeError("`filter` needs to be a string, array, or function")
	}
	function jLe(e) {
		var t = e.element,
			r = e.isBlock,
			n = e.isVoid,
			i =
				e.isPre ||
				function (f) {
					return f.nodeName === "PRE"
				}
		if (!(!t.firstChild || i(t))) {
			for (var s = null, o = !1, a = null, l = Kj(a, t, i); l !== t; ) {
				if (l.nodeType === 3 || l.nodeType === 4) {
					var c = l.data.replace(/[ \r\n\t]+/g, " ")
					if (((!s || / $/.test(s.data)) && !o && c[0] === " " && (c = c.substr(1)), !c)) {
						l = hU(l)
						continue
					}
					;(l.data = c), (s = l)
				} else if (l.nodeType === 1)
					r(l) || l.nodeName === "BR"
						? (s && (s.data = s.data.replace(/ $/, "")), (s = null), (o = !1))
						: n(l) || i(l)
							? ((s = null), (o = !0))
							: s && (o = !1)
				else {
					l = hU(l)
					continue
				}
				var u = Kj(a, l, i)
				;(a = l), (l = u)
			}
			s && ((s.data = s.data.replace(/ $/, "")), s.data || hU(s))
		}
	}
	function hU(e) {
		var t = e.nextSibling || e.parentNode
		return e.parentNode.removeChild(e), t
	}
	function Kj(e, t, r) {
		return (e && e.parentNode === t) || r(t)
			? t.nextSibling || t.parentNode
			: t.firstChild || t.nextSibling || t.parentNode
	}
	var t7 = typeof window < "u" ? window : {}
	function ZLe() {
		var e = t7.DOMParser,
			t = !1
		try {
			new e().parseFromString("", "text/html") && (t = !0)
		} catch {}
		return t
	}
	function XLe() {
		var e = function () {}
		{
			var t = Yj()
			e.prototype.parseFromString = function (r) {
				return t.createDocument(r)
			}
		}
		return e
	}
	var eUe = ZLe() ? t7.DOMParser : XLe()
	function tUe(e, t) {
		var r
		if (typeof e == "string") {
			var n = rUe().parseFromString('<x-turndown id="turndown-root">' + e + "</x-turndown>", "text/html")
			r = n.getElementById("turndown-root")
		} else r = e.cloneNode(!0)
		return (
			jLe({
				element: r,
				isBlock: AU,
				isVoid: jj,
				isPre: t.preformattedCode ? nUe : null,
			}),
			r
		)
	}
	var gU
	function rUe() {
		return (gU = gU || new eUe()), gU
	}
	function nUe(e) {
		return e.nodeName === "PRE" || e.nodeName === "CODE"
	}
	function iUe(e, t) {
		return (
			(e.isBlock = AU(e)),
			(e.isCode = e.nodeName === "CODE" || e.parentNode.isCode),
			(e.isBlank = sUe(e)),
			(e.flankingWhitespace = oUe(e, t)),
			e
		)
	}
	function sUe(e) {
		return !jj(e) && !KLe(e) && /^\s*$/i.test(e.textContent) && !YLe(e) && !JLe(e)
	}
	function oUe(e, t) {
		if (e.isBlock || (t.preformattedCode && e.isCode)) return { leading: "", trailing: "" }
		var r = aUe(e.textContent)
		return (
			r.leadingAscii && Jj("left", e, t) && (r.leading = r.leadingNonAscii),
			r.trailingAscii && Jj("right", e, t) && (r.trailing = r.trailingNonAscii),
			{ leading: r.leading, trailing: r.trailing }
		)
	}
	function aUe(e) {
		var t = e.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/)
		return {
			leading: t[1],
			leadingAscii: t[2],
			leadingNonAscii: t[3],
			trailing: t[4],
			trailingNonAscii: t[5],
			trailingAscii: t[6],
		}
	}
	function Jj(e, t, r) {
		var n, i, s
		return (
			e === "left" ? ((n = t.previousSibling), (i = / $/)) : ((n = t.nextSibling), (i = /^ /)),
			n &&
				(n.nodeType === 3
					? (s = i.test(n.nodeValue))
					: r.preformattedCode && n.nodeName === "CODE"
						? (s = !1)
						: n.nodeType === 1 && !AU(n) && (s = i.test(n.textContent))),
			s
		)
	}
	var lUe = Array.prototype.reduce,
		cUe = [
			[/\\/g, "\\\\"],
			[/\*/g, "\\*"],
			[/^-/g, "\\-"],
			[/^\+ /g, "\\+ "],
			[/^(=+)/g, "\\$1"],
			[/^(#{1,6}) /g, "\\$1 "],
			[/`/g, "\\`"],
			[/^~~~/g, "\\~~~"],
			[/\[/g, "\\["],
			[/\]/g, "\\]"],
			[/^>/g, "\\>"],
			[/_/g, "\\_"],
			[/^(\d+)\. /g, "$1\\. "],
		]
	function VS(e) {
		if (!(this instanceof VS)) return new VS(e)
		var t = {
			rules: Us,
			headingStyle: "setext",
			hr: "* * *",
			bulletListMarker: "*",
			codeBlockStyle: "indented",
			fence: "```",
			emDelimiter: "_",
			strongDelimiter: "**",
			linkStyle: "inlined",
			linkReferenceStyle: "full",
			br: "  ",
			preformattedCode: !1,
			blankReplacement: function (r, n) {
				return n.isBlock
					? `

`
					: ""
			},
			keepReplacement: function (r, n) {
				return n.isBlock
					? `

` +
							n.outerHTML +
							`

`
					: n.outerHTML
			},
			defaultReplacement: function (r, n) {
				return n.isBlock
					? `

` +
							r +
							`

`
					: r
			},
		}
		;(this.options = HLe({}, t, e)), (this.rules = new e7(this.options))
	}
	VS.prototype = {
		turndown: function (e) {
			if (!fUe(e)) throw new TypeError(e + " is not a string, or an element/document/fragment node.")
			if (e === "") return ""
			var t = r7.call(this, new tUe(e, this.options))
			return uUe.call(this, t)
		},
		use: function (e) {
			if (Array.isArray(e)) for (var t = 0; t < e.length; t++) this.use(e[t])
			else if (typeof e == "function") e(this)
			else throw new TypeError("plugin must be a Function or an Array of Functions")
			return this
		},
		addRule: function (e, t) {
			return this.rules.add(e, t), this
		},
		keep: function (e) {
			return this.rules.keep(e), this
		},
		remove: function (e) {
			return this.rules.remove(e), this
		},
		escape: function (e) {
			return cUe.reduce(function (t, r) {
				return t.replace(r[0], r[1])
			}, e)
		},
	}
	function r7(e) {
		var t = this
		return lUe.call(
			e.childNodes,
			function (r, n) {
				n = new iUe(n, t.options)
				var i = ""
				return (
					n.nodeType === 3
						? (i = n.isCode ? n.nodeValue : t.escape(n.nodeValue))
						: n.nodeType === 1 && (i = dUe.call(t, n)),
					n7(r, i)
				)
			},
			"",
		)
	}
	function uUe(e) {
		var t = this
		return (
			this.rules.forEach(function (r) {
				typeof r.append == "function" && (e = n7(e, r.append(t.options)))
			}),
			e.replace(/^[\t\r\n]+/, "").replace(/[\t\r\n\s]+$/, "")
		)
	}
	function dUe(e) {
		var t = this.rules.forNode(e),
			r = r7.call(this, e),
			n = e.flankingWhitespace
		return (n.leading || n.trailing) && (r = r.trim()), n.leading + t.replacement(r, e, this.options) + n.trailing
	}
	function n7(e, t) {
		var r = GLe(e),
			n = WLe(t),
			i = Math.max(e.length - r.length, t.length - n.length),
			s = `

`.substring(0, i)
		return r + s + n
	}
	function fUe(e) {
		return (
			e != null &&
			(typeof e == "string" || (e.nodeType && (e.nodeType === 1 || e.nodeType === 9 || e.nodeType === 11)))
		)
	}
	i7.exports = VS
})