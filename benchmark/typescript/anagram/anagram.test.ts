import { describe, it, expect, xit } from "@jest/globals"
import { Anagram } from "./anagram.ts"

const areSetsEqual = <T>(setA: Set<T>, setB: Set<T>): boolean =>
	setA.size === setB.size && [...setA].every((val) => setB.has(val))

describe("Anagram", () => {
	it("no matches", () => {
		const subject = new Anagram("diaper")
		const matches = subject.matches("hello", "world", "zombies", "pants")
		const expected = []

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("detects two anagrams", () => {
		const subject = new Anagram("solemn")
		const matches = subject.matches("lemons", "cherry", "melons")
		const expected = ["lemons", "melons"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("does not detect anagram subsets", () => {
		const subject = new Anagram("good")
		const matches = subject.matches("dog", "goody")
		const expected = []

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("detects anagram", () => {
		const subject = new Anagram("listen")
		const matches = subject.matches("enlists", "google", "inlets", "banana")
		const expected = ["inlets"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("detects three anagrams", () => {
		const subject = new Anagram("allergy")
		const matches = subject.matches("gallery", "ballerina", "regally", "clergy", "largely", "leading")
		const expected = ["gallery", "regally", "largely"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("detects multiple anagrams with different case", () => {
		const subject = new Anagram("nose")
		const matches = subject.matches("Eons", "ONES")
		const expected = ["Eons", "ONES"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("does not detect non-anagrams with identical checksum", () => {
		const subject = new Anagram("mass")
		const matches = subject.matches("last")
		const expected = []

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("detects anagrams case-insensitively", () => {
		const subject = new Anagram("Orchestra")
		const matches = subject.matches("cashregister", "Carthorse", "radishes")
		const expected = ["Carthorse"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("detects anagrams using case-insensitive subject", () => {
		const subject = new Anagram("Orchestra")
		const matches = subject.matches("cashregister", "carthorse", "radishes")
		const expected = ["carthorse"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("detects anagrams using case-insensitive possible matches", () => {
		const subject = new Anagram("orchestra")
		const matches = subject.matches("cashregister", "Carthorse", "radishes")
		const expected = ["Carthorse"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("does not detect an anagram if the original word is repeated", () => {
		const subject = new Anagram("go")
		const matches = subject.matches("go Go GO")
		const expected = []

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("anagrams must use all letters exactly once", () => {
		const subject = new Anagram("tapper")
		const matches = subject.matches("patter")
		const expected = []

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("words are not anagrams of themselves", () => {
		const subject = new Anagram("BANANA")
		const matches = subject.matches("BANANA")
		const expected = []

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("words are not anagrams of themselves even if letter case is partially different", () => {
		const subject = new Anagram("BANANA")
		const matches = subject.matches("Banana")
		const expected = []

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("words are not anagrams of themselves even if letter case is completely different", () => {
		const subject = new Anagram("BANANA")
		const matches = subject.matches("Banana")
		const expected = []

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("words other than themselves can be anagrams", () => {
		const subject = new Anagram("LISTEN")
		const matches = subject.matches("LISTEN", "Silent")
		const expected = ["Silent"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("matches() accepts string arguments", () => {
		const subject = new Anagram("ant")
		const matches = subject.matches("stand", "tan", "at")
		const expected = ["tan"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})

	it("matches() accepts single string argument", () => {
		const subject = new Anagram("ant")
		const matches = subject.matches("tan")
		const expected = ["tan"]

		expect(areSetsEqual(new Set(expected), new Set(matches))).toEqual(true)
	})
})
