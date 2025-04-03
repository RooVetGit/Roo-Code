
var uC = class e {
		constructor(t, r, n, i, s) {
			this.ctrlKey = t
			this.shiftKey = r
			this.altKey = n
			this.metaKey = i
			this.keyCode = s
		}
		equals(t) {
			return (
				t instanceof e &&
				this.ctrlKey === t.ctrlKey &&
				this.shiftKey === t.shiftKey &&
				this.altKey === t.altKey &&
				this.metaKey === t.metaKey &&
				this.keyCode === t.keyCode
			)
		}
		getHashCode() {
			let t = this.ctrlKey ? "1" : "0",
				r = this.shiftKey ? "1" : "0",
				n = this.altKey ? "1" : "0",
				i = this.metaKey ? "1" : "0"
			return `K${t}${r}${n}${i}${this.keyCode}`
		}
		isModifierKey() {
			return (
				this.keyCode === 0 ||
				this.keyCode === 5 ||
				this.keyCode === 57 ||
				this.keyCode === 6 ||
				this.keyCode === 4
			)
		}
		toKeybinding() {
			return new gA([this])
		}
		isDuplicateModifierCase() {
			return (
				(this.ctrlKey && this.keyCode === 5) ||
				(this.shiftKey && this.keyCode === 4) ||
				(this.altKey && this.keyCode === 6) ||
				(this.metaKey && this.keyCode === 57)
			)
		}
	},
	Jh = class e {
		constructor(t, r, n, i, s) {
			this.ctrlKey = t
			this.shiftKey = r
			this.altKey = n
			this.metaKey = i
			this.scanCode = s
		}
		equals(t) {
			return (
				t instanceof e &&
				this.ctrlKey === t.ctrlKey &&
				this.shiftKey === t.shiftKey &&
				this.altKey === t.altKey &&
				this.metaKey === t.metaKey &&
				this.scanCode === t.scanCode
			)
		}
		getHashCode() {
			let t = this.ctrlKey ? "1" : "0",
				r = this.shiftKey ? "1" : "0",
				n = this.altKey ? "1" : "0",
				i = this.metaKey ? "1" : "0"
			return `S${t}${r}${n}${i}${this.scanCode}`
		}
		isDuplicateModifierCase() {
			return (
				(this.ctrlKey && (this.scanCode === 157 || this.scanCode === 161)) ||
				(this.shiftKey && (this.scanCode === 158 || this.scanCode === 162)) ||
				(this.altKey && (this.scanCode === 159 || this.scanCode === 163)) ||
				(this.metaKey && (this.scanCode === 160 || this.scanCode === 164))
			)
		}
	},
	gA = class {
		chords
		constructor(t) {
			if (t.length === 0) throw nxe("chords")
			this.chords = t
		}
		getHashCode() {
			let t = ""
			for (let r = 0, n = this.chords.length; r < n; r++)
				r !== 0 && (t += ";"), (t += this.chords[r].getHashCode())
			return t
		}
		equals(t) {
			if (t === null || this.chords.length !== t.chords.length) return !1
			for (let r = 0; r < this.chords.length; r++) if (!this.chords[r].equals(t.chords[r])) return !1
			return !0
		}
	}