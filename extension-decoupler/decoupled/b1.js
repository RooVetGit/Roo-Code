
var B1 = class extends eg {
	constructor() {
		super(100, (t) => t.completions.length > 0 && !t.isReused)
	}
}