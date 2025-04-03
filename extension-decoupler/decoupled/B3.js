
var B3 = x((PDt, YT) => {
	"use strict"
	var { configs: Rnt, LEVEL: Bfe, MESSAGE: S3 } = Bi(),
		$T = class e {
			constructor(t = { levels: Rnt.npm.levels }) {
				;(this.paddings = e.paddingForLevels(t.levels, t.filler)), (this.options = t)
			}
			static getLongestLevel(t) {
				let r = Object.keys(t).map((n) => n.length)
				return Math.max(...r)
			}
			static paddingForLevel(t, r, n) {
				let i = n + 1 - t.length,
					s = Math.floor(i / r.length)
				return `${r}${r.repeat(s)}`.slice(0, i)
			}
			static paddingForLevels(t, r = " ") {
				let n = e.getLongestLevel(t)
				return Object.keys(t).reduce((i, s) => ((i[s] = e.paddingForLevel(s, r, n)), i), {})
			}
			transform(t, r) {
				return (
					(t.message = `${this.paddings[t[Bfe]]}${t.message}`),
					t[S3] && (t[S3] = `${this.paddings[t[Bfe]]}${t[S3]}`),
					t
				)
			}
		}
	YT.exports = (e) => new $T(e)
	YT.exports.Padder = YT.exports.Format = $T
})