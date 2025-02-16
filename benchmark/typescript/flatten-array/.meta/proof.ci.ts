export function flatten<A, T extends Array<A | A[]>>(arr: T): A[] {
	return arr
		.reduce((acc: A[], el) => (Array.isArray(el) ? acc.concat(flatten(el)) : acc.concat(el)), [])
		.filter((el: A) => el !== null && el !== undefined)
}
