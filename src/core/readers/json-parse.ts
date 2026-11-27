/**
 * A JSON parser for reading tables. Unlike JSON.parse, it keeps object keys in
 * the order they were written (JavaScript objects put keys like "2024" first)
 * and keeps numbers exactly as written, so "1.50" and big IDs survive.
 */

/** A number from the input, kept as written. */
export class RawNumber {
  readonly source: string
  constructor(source: string) {
    this.source = source
  }
}

/** Objects are Maps, which keep keys in the order they were written. */
export type JsonValue = string | boolean | null | RawNumber | JsonValue[] | Map<string, JsonValue>

export class JsonSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JsonSyntaxError"
  }
}

/** Deeper than any table; also keeps the parser well clear of the call stack limit. */
const MAX_DEPTH = 1000
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
const LITERALS: [string, JsonValue][] = [
  ["true", true],
  ["false", false],
  ["null", null],
]

export function parseOrderedJson(text: string): JsonValue {
  let i = 0

  const fail = (expected: string): never => {
    throw new JsonSyntaxError(
      i < text.length ? `Expected ${expected} at position ${i}.` : `Expected ${expected}, but the text ended.`
    )
  }

  const skipSpace = () => {
    for (;;) {
      const code = text.charCodeAt(i)
      if (code === 0x20 || code === 0x0a || code === 0x0d || code === 0x09) i++
      else return
    }
  }

  const parseString = (): string => {
    const start = i++
    let plain = true
    for (;;) {
      if (i >= text.length) fail('a closing "')
      const code = text.charCodeAt(i)
      if (code === 0x22) break
      if (code === 0x5c) {
        plain = false
        i += 2
      } else {
        if (code < 0x20) plain = false
        i++
      }
    }
    i++
    if (plain) return text.slice(start + 1, i - 1)
    // Escapes and stray control characters: JSON.parse decodes and checks them.
    try {
      return JSON.parse(text.slice(start, i)) as string
    } catch {
      i = start
      return fail("a valid string")
    }
  }

  const parseValue = (depth: number): JsonValue => {
    if (depth > MAX_DEPTH) throw new JsonSyntaxError("This JSON is nested too deeply.")
    skipSpace()
    const char = text[i]
    if (char === "{") {
      i++
      const object = new Map<string, JsonValue>()
      skipSpace()
      if (text[i] === "}") {
        i++
        return object
      }
      for (;;) {
        skipSpace()
        if (text[i] !== '"') fail("a property name")
        const key = parseString()
        skipSpace()
        if (text[i] !== ":") fail("':'")
        i++
        object.set(key, parseValue(depth + 1))
        skipSpace()
        if (text[i] === ",") i++
        else if (text[i] === "}") {
          i++
          return object
        } else fail("',' or '}'")
      }
    }
    if (char === "[") {
      i++
      const array: JsonValue[] = []
      skipSpace()
      if (text[i] === "]") {
        i++
        return array
      }
      for (;;) {
        array.push(parseValue(depth + 1))
        skipSpace()
        if (text[i] === ",") i++
        else if (text[i] === "]") {
          i++
          return array
        } else fail("',' or ']'")
      }
    }
    if (char === '"') return parseString()
    NUMBER.lastIndex = i
    const number = NUMBER.exec(text)
    if (number) {
      i += number[0].length
      return new RawNumber(number[0])
    }
    for (const [word, value] of LITERALS) {
      if (text.startsWith(word, i)) {
        i += word.length
        return value
      }
    }
    return fail("a value")
  }

  const value = parseValue(0)
  skipSpace()
  if (i < text.length) fail("the end")
  return value
}
