
var o7 = W(s7()),
	HS = class extends rn {
		_turndownService
		_userAgent
		constructor(t) {
			super(ja.webFetch, xt.Unsafe)
			let r = new o7.default()
			r.addRule("removeStyleAndScriptTags", {
				filter: ["style", "script"],
				replacement: function () {
					return ""
				},
			}),
				(this._turndownService = r),
				(this._userAgent = t || "Augment-WebFetch/1.0")
		}
		description = `Fetches data from a webpage and converts it into Markdown.

1. The tool takes in a URL and returns the content of the page in Markdown format;
2. If the return is not valid Markdown, it means the tool cannot successfully parse this page.`
		inputSchemaJson = JSON.stringify({
			type: "object",
			properties: { url: { type: "string", description: "The URL to fetch." } },
			required: ["url"],
		})
		checkToolCallSafe(t) {
			return !1
		}
		async call(t, r, n) {
			let i = t.url
			try {
				let o = await (
					await fetch(i, {
						signal: n,
						headers: { "User-Agent": this._userAgent },
					})
				).text()
				return { text: this._turndownService.turndown(o), isError: !1 }
			} catch (s) {
				return {
					text: `Failed to fetch URL: ${i}: ${s instanceof Error ? s.message : String(s)}`,
					isError: !0,
				}
			}
		}
	}