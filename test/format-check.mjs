// Self-check for the path convention this plugin deletes through.
//
// The deletion target must be exactly the directory the JSONL backend owns, so
// these two functions are checked against real directories on this machine:
//
//   node test/format-check.mjs
//
// Every expectation printed as OK means the local sessions root contains the
// directory this plugin would remove for that cwd.
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { projectKey, sessionsRoot } from '../lib/index.js'

const cases = [
	['D:\\DeepSeekHarness\\workspace', '--D-DeepSeekHarness-workspace--'],
	['D:\\DeepSeekHarness\\workspace\\知识库', '--D-DeepSeekHarness-workspace-~77E5~8BC6~5E93--'],
	['D:\\DeepSeekHarness\\workspace\\金融市场', '--D-DeepSeekHarness-workspace-~91D1~878D~5E02~573A--'],
]

let failures = 0
for (const [cwd, expected] of cases) {
	const actual = projectKey(cwd)
	const ok = actual === expected
	if (!ok) failures += 1
	console.log(`${ok ? 'OK  ' : 'FAIL'} projectKey(${cwd}) = ${actual}${ok ? '' : ` (expected ${expected})`}`)
}

// Cross-check against what the local sessions root actually contains.
const root = sessionsRoot()
console.log(`\nsessions root: ${root}`)
let entries = []
try {
	entries = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name)
} catch (error) {
	console.log(`  (unreadable: ${error instanceof Error ? error.message : String(error)})`)
}
console.log(`  ${entries.length} project directories`)
for (const [cwd] of cases) {
	const key = projectKey(cwd)
	const present = entries.includes(key)
	if (!present) failures += 1
	console.log(`${present ? 'OK  ' : 'FAIL'} ${key} ${present ? 'exists on disk' : 'is not present on disk'}`)
}

// Directory-name sanity: every existing project directory must be reproducible
// from some cwd only if we knew that cwd; here we only assert the shape.
const malformed = entries.filter(name => !(name.startsWith('--') && name.endsWith('--')))
if (malformed.length > 0) {
	failures += 1
	console.log(`FAIL ${malformed.length} unexpected directory name(s): ${malformed.slice(0, 3).join(', ')}`)
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`)
process.exitCode = failures === 0 ? 0 : 1

export { join }
