
		function nd(_, I, L, te) {
			function oe(ln) {
				for (var Qi = 0, Zs = ln.length; Qi < Zs; Qi++)
					switch (ln[Qi][0]) {
						case "color":
						case "face":
						case "size":
							return !0
					}
				return !1
			}
			var Be
			switch (_) {
				case 1:
					Ce && TLe.test(I) && (Ce = !1), Tr && (I = I.replace(FS, "\uFFFD")), Ua(I)
					return
				case 4:
					La(I)
					return
				case 5:
					return
				case 2:
					switch (I) {
						case "font":
							if (!oe(L)) break
						case "b":
						case "big":
						case "blockquote":
						case "body":
						case "br":
						case "center":
						case "code":
						case "dd":
						case "div":
						case "dl":
						case "dt":
						case "em":
						case "embed":
						case "h1":
						case "h2":
						case "h3":
						case "h4":
						case "h5":
						case "h6":
						case "head":
						case "hr":
						case "i":
						case "img":
						case "li":
						case "listing":
						case "menu":
						case "meta":
						case "nobr":
						case "ol":
						case "p":
						case "pre":
						case "ruby":
						case "s":
						case "small":
						case "span":
						case "strong":
						case "strike":
						case "sub":
						case "sup":
						case "table":
						case "tt":
						case "u":
						case "ul":
						case "var":
							if (K) break
							do N.pop(), (Be = N.top)
							while (Be.namespaceURI !== ot.HTML && !yj(Be) && !Cj(Be))
							Cn(_, I, L, te)
							return
					}
					;(Be = N.elements.length === 1 && K ? t : N.top),
						Be.namespaceURI === ot.MATHML ? Ej(L) : Be.namespaceURI === ot.SVG && ((I = kLe(I)), vj(L)),
						iU(L),
						GC(I, L, Be.namespaceURI),
						te && (I === "script" && (Be.namespaceURI, ot.SVG), N.pop())
					return
				case 3:
					if (((Be = N.top), I === "script" && Be.namespaceURI === ot.SVG && Be.localName === "script"))
						N.pop()
					else
						for (var st = N.elements.length - 1, qt = N.elements[st]; ; ) {
							if (qt.localName.toLowerCase() === I) {
								N.popElement(qt)
								break
							}
							if (((qt = N.elements[--st]), qt.namespaceURI === ot.HTML)) {
								q(_, I, L, te)
								break
							}
						}
					return
			}
		}