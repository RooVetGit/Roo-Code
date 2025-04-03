
	var hS = Object.create(null, {
			location: {
				get: function () {
					throw new Error("window.location is not supported.")
				},
			},
		}),
		tPe = function (e, t) {
			return e.compareDocumentPosition(t)
		},
		rPe = function (e, t) {
			return tPe(e, t) & 2 ? 1 : -1
		},
		pS = function (e) {
			for (; (e = e.nextSibling) && e.nodeType !== 1; );
			return e
		},
		wm = function (e) {
			for (; (e = e.previousSibling) && e.nodeType !== 1; );
			return e
		},
		nPe = function (e) {
			if ((e = e.firstChild)) for (; e.nodeType !== 1 && (e = e.nextSibling); );
			return e
		},
		iPe = function (e) {
			if ((e = e.lastChild)) for (; e.nodeType !== 1 && (e = e.previousSibling); );
			return e
		},
		_m = function (e) {
			if (!e.parentNode) return !1
			var t = e.parentNode.nodeType
			return t === 1 || t === 9
		},
		kJ = function (e) {
			if (!e) return e
			var t = e[0]
			return t === '"' || t === "'"
				? (e[e.length - 1] === t ? (e = e.slice(1, -1)) : (e = e.slice(1)),
					e.replace(mt.str_escape, function (r) {
						var n = /^\\(?:([0-9A-Fa-f]+)|([\r\n\f]+))/.exec(r)
						if (!n) return r.slice(1)
						if (n[2]) return ""
						var i = parseInt(n[1], 16)
						return String.fromCodePoint ? String.fromCodePoint(i) : String.fromCharCode(i)
					}))
				: mt.ident.test(e)
					? Lf(e)
					: e
		},
		Lf = function (e) {
			return e.replace(mt.escape, function (t) {
				var r = /^\\([0-9A-Fa-f]+)/.exec(t)
				if (!r) return t[1]
				var n = parseInt(r[1], 16)
				return String.fromCodePoint ? String.fromCodePoint(n) : String.fromCharCode(n)
			})
		},
		sPe = (function () {
			return Array.prototype.indexOf
				? Array.prototype.indexOf
				: function (e, t) {
						for (var r = this.length; r--; ) if (this[r] === t) return r
						return -1
					}
		})(),
		FJ = function (e, t) {
			var r = mt.inside.source.replace(/</g, e).replace(/>/g, t)
			return new RegExp(r)
		},
		Qo = function (e, t, r) {
			return (e = e.source), (e = e.replace(t, r.source || r)), new RegExp(e)
		},
		MJ = function (e, t) {
			return e
				.replace(/^(?:\w+:\/\/|\/+)/, "")
				.replace(/(?:\/+|\/*#.*?)$/, "")
				.split("/", t)
				.join("/")
		},
		oPe = function (e, t) {
			var r = e.replace(/\s+/g, ""),
				n
			return (
				r === "even" ? (r = "2n+0") : r === "odd" ? (r = "2n+1") : r.indexOf("n") === -1 && (r = "0n" + r),
				(n = /^([+-])?(\d+)?n([+-])?(\d+)?$/.exec(r)),
				{
					group: n[1] === "-" ? -(n[2] || 1) : +(n[2] || 1),
					offset: n[4] ? (n[3] === "-" ? -n[4] : +n[4]) : 0,
				}
			)
		},
		yL = function (e, t, r) {
			var n = oPe(e),
				i = n.group,
				s = n.offset,
				o = r ? iPe : nPe,
				a = r ? wm : pS
			return function (l) {
				if (_m(l))
					for (var c = o(l.parentNode), u = 0; c; ) {
						if ((t(c, l) && u++, c === l)) return (u -= s), i && u ? u % i === 0 && u < 0 == i < 0 : !u
						c = a(c)
					}
			}
		},
		Yi = {
			"*": (function () {
				return function () {
					return !0
				}
			})(),
			type: function (e) {
				return (
					(e = e.toLowerCase()),
					function (t) {
						return t.nodeName.toLowerCase() === e
					}
				)
			},
			attr: function (e, t, r, n) {
				return (
					(t = QJ[t]),
					function (i) {
						var s
						switch (e) {
							case "for":
								s = i.htmlFor
								break
							case "class":
								;(s = i.className), s === "" && i.getAttribute("class") == null && (s = null)
								break
							case "href":
							case "src":
								s = i.getAttribute(e, 2)
								break
							case "title":
								s = i.getAttribute("title") || null
								break
							case "id":
							case "lang":
							case "dir":
							case "accessKey":
							case "hidden":
							case "tabIndex":
							case "style":
								if (i.getAttribute) {
									s = i.getAttribute(e)
									break
								}
							default:
								if (i.hasAttribute && !i.hasAttribute(e)) break
								s = i[e] != null ? i[e] : i.getAttribute && i.getAttribute(e)
								break
						}
						if (s != null) return (s = s + ""), n && ((s = s.toLowerCase()), (r = r.toLowerCase())), t(s, r)
					}
				)
			},
			":first-child": function (e) {
				return !wm(e) && _m(e)
			},
			":last-child": function (e) {
				return !pS(e) && _m(e)
			},
			":only-child": function (e) {
				return !wm(e) && !pS(e) && _m(e)
			},
			":nth-child": function (e, t) {
				return yL(
					e,
					function () {
						return !0
					},
					t,
				)
			},
			":nth-last-child": function (e) {
				return Yi[":nth-child"](e, !0)
			},
			":root": function (e) {
				return e.ownerDocument.documentElement === e
			},
			":empty": function (e) {
				return !e.firstChild
			},
			":not": function (e) {
				var t = vL(e)
				return function (r) {
					return !t(r)
				}
			},
			":first-of-type": function (e) {
				if (_m(e)) {
					for (var t = e.nodeName; (e = wm(e)); ) if (e.nodeName === t) return
					return !0
				}
			},
			":last-of-type": function (e) {
				if (_m(e)) {
					for (var t = e.nodeName; (e = pS(e)); ) if (e.nodeName === t) return
					return !0
				}
			},
			":only-of-type": function (e) {
				return Yi[":first-of-type"](e) && Yi[":last-of-type"](e)
			},
			":nth-of-type": function (e, t) {
				return yL(
					e,
					function (r, n) {
						return r.nodeName === n.nodeName
					},
					t,
				)
			},
			":nth-last-of-type": function (e) {
				return Yi[":nth-of-type"](e, !0)
			},
			":checked": function (e) {
				return !!(e.checked || e.selected)
			},
			":indeterminate": function (e) {
				return !Yi[":checked"](e)
			},
			":enabled": function (e) {
				return !e.disabled && e.type !== "hidden"
			},
			":disabled": function (e) {
				return !!e.disabled
			},
			":target": function (e) {
				return e.id === hS.location.hash.substring(1)
			},
			":focus": function (e) {
				return e === e.ownerDocument.activeElement
			},
			":is": function (e) {
				return vL(e)
			},
			":matches": function (e) {
				return Yi[":is"](e)
			},
			":nth-match": function (e, t) {
				var r = e.split(/\s*,\s*/),
					n = r.shift(),
					i = vL(r.join(","))
				return yL(n, i, t)
			},
			":nth-last-match": function (e) {
				return Yi[":nth-match"](e, !0)
			},
			":links-here": function (e) {
				return e + "" == hS.location + ""
			},
			":lang": function (e) {
				return function (t) {
					for (; t; ) {
						if (t.lang) return t.lang.indexOf(e) === 0
						t = t.parentNode
					}
				}
			},
			":dir": function (e) {
				return function (t) {
					for (; t; ) {
						if (t.dir) return t.dir === e
						t = t.parentNode
					}
				}
			},
			":scope": function (e, t) {
				var r = t || e.ownerDocument
				return r.nodeType === 9 ? e === r.documentElement : e === r
			},
			":any-link": function (e) {
				return typeof e.href == "string"
			},
			":local-link": function (e) {
				if (e.nodeName) return e.href && e.host === hS.location.host
				var t = +e + 1
				return function (r) {
					if (r.href) {
						var n = hS.location + "",
							i = r + ""
						return MJ(n, t) === MJ(i, t)
					}
				}
			},
			":default": function (e) {
				return !!e.defaultSelected
			},
			":valid": function (e) {
				return e.willValidate || (e.validity && e.validity.valid)
			},
			":invalid": function (e) {
				return !Yi[":valid"](e)
			},
			":in-range": function (e) {
				return e.value > e.min && e.value <= e.max
			},
			":out-of-range": function (e) {
				return !Yi[":in-range"](e)
			},
			":required": function (e) {
				return !!e.required
			},
			":optional": function (e) {
				return !e.required
			},
			":read-only": function (e) {
				if (e.readOnly) return !0
				var t = e.getAttribute("contenteditable"),
					r = e.contentEditable,
					n = e.nodeName.toLowerCase()
				return (n = n !== "input" && n !== "textarea"), (n || e.disabled) && t == null && r !== "true"
			},
			":read-write": function (e) {
				return !Yi[":read-only"](e)
			},
			":hover": function () {
				throw new Error(":hover is not supported.")
			},
			":active": function () {
				throw new Error(":active is not supported.")
			},
			":link": function () {
				throw new Error(":link is not supported.")
			},
			":visited": function () {
				throw new Error(":visited is not supported.")
			},
			":column": function () {
				throw new Error(":column is not supported.")
			},
			":nth-column": function () {
				throw new Error(":nth-column is not supported.")
			},
			":nth-last-column": function () {
				throw new Error(":nth-last-column is not supported.")
			},
			":current": function () {
				throw new Error(":current is not supported.")
			},
			":past": function () {
				throw new Error(":past is not supported.")
			},
			":future": function () {
				throw new Error(":future is not supported.")
			},
			":contains": function (e) {
				return function (t) {
					var r = t.innerText || t.textContent || t.value || ""
					return r.indexOf(e) !== -1
				}
			},
			":has": function (e) {
				return function (t) {
					return NJ(e, t).length > 0
				}
			},
		},
		QJ = {
			"-": function () {
				return !0
			},
			"=": function (e, t) {
				return e === t
			},
			"*=": function (e, t) {
				return e.indexOf(t) !== -1
			},
			"~=": function (e, t) {
				var r, n, i, s
				for (n = 0; ; n = r + 1) {
					if (((r = e.indexOf(t, n)), r === -1)) return !1
					if (((i = e[r - 1]), (s = e[r + t.length]), (!i || i === " ") && (!s || s === " "))) return !0
				}
			},
			"|=": function (e, t) {
				var r = e.indexOf(t),
					n
				if (r === 0) return (n = e[r + t.length]), n === "-" || !n
			},
			"^=": function (e, t) {
				return e.indexOf(t) === 0
			},
			"$=": function (e, t) {
				var r = e.lastIndexOf(t)
				return r !== -1 && r + t.length === e.length
			},
			"!=": function (e, t) {
				return e !== t
			},
		},
		jv = {
			" ": function (e) {
				return function (t) {
					for (; (t = t.parentNode); ) if (e(t)) return t
				}
			},
			">": function (e) {
				return function (t) {
					if ((t = t.parentNode)) return e(t) && t
				}
			},
			"+": function (e) {
				return function (t) {
					if ((t = wm(t))) return e(t) && t
				}
			},
			"~": function (e) {
				return function (t) {
					for (; (t = wm(t)); ) if (e(t)) return t
				}
			},
			noop: function (e) {
				return function (t) {
					return e(t) && t
				}
			},
			ref: function (e, t) {
				var r
				function n(i) {
					for (var s = i.ownerDocument, o = s.getElementsByTagName("*"), a = o.length; a--; )
						if (((r = o[a]), n.test(i))) return (r = null), !0
					r = null
				}
				return (
					(n.combinator = function (i) {
						if (!(!r || !r.getAttribute)) {
							var s = r.getAttribute(t) || ""
							if ((s[0] === "#" && (s = s.substring(1)), s === i.id && e(r))) return r
						}
					}),
					n
				)
			},
		},
		mt = {
			escape: /\\(?:[^0-9A-Fa-f\r\n]|[0-9A-Fa-f]{1,6}[\r\n\t ]?)/g,
			str_escape: /(escape)|\\(\n|\r\n?|\f)/g,
			nonascii: /[\u00A0-\uFFFF]/,
			cssid: /(?:(?!-?[0-9])(?:escape|nonascii|[-_a-zA-Z0-9])+)/,
			qname: /^ *(cssid|\*)/,
			simple: /^(?:([.#]cssid)|pseudo|attr)/,
			ref: /^ *\/(cssid)\/ */,
			combinator: /^(?: +([^ \w*.#\\]) +|( )+|([^ \w*.#\\]))(?! *$)/,
			attr: /^\[(cssid)(?:([^\w]?=)(inside))?\]/,
			pseudo: /^(:cssid)(?:\((inside)\))?/,
			inside: /(?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|<[^"'>]*>|\\["'>]|[^"'>])*/,
			ident: /^(cssid)$/,
		}