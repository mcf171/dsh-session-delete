// dsh-session-delete — node half (host plugin).
//
// Adds the one session action the stock GUI does not ship: permanent deletion.
// The browser half registers the row-menu item, the guard for a running
// session, and the confirmation; this half owns the destructive step over one
// same-origin route:
//
//   POST /_dsh/dsh-session-delete/delete   { "sessionId": "session-…" }
//   → 200 { ok: true, sessionId, directory }
//   → 404 { ok: false, code: 'session-not-found' | 'log-not-found', message }
//   → 409 { ok: false, code: 'session-running', message }
//
// Deleting a session removes the directory the JSONL persistence backend owns
// for it (`<sessions root>/<projectKey(cwd)>/<encodeSegment(id)>/`, holding
// `session.jsonl.zstd`), then relays `api-session/removed` so the browser drops
// the row immediately. The list itself is built from a persistence scan plus
// the live in-memory sessions (`@deepseek-ai/dsh-session-query` corpus), and
// `SessionStore` has no removal: a session that was already loaded stays
// resident until the host restarts. That residency is harmless for an idle
// session — the row is gone and nothing reads the deleted log — so this route
// only refuses a session that still has a live agent appending to it.
import { readdir, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Stable Cordis plugin name (also the package id the client half rides on). */
export const name = 'dsh-session-delete'

/** Services this host row needs before it activates. */
export const inject = ['webServer']

/** Same-origin route the browser half talks to. */
export const DELETE_ROUTE = '/_dsh/dsh-session-delete/delete'

/** Request bodies are one id; anything larger is not this route's traffic. */
const MAX_BODY_BYTES = 64 * 1024

/**
 * Path-encode one path segment exactly as the JSONL backend does
 * (`@deepseek-ai/dsh-session-persistence-jsonl` format.ts `encodeSegment`), so
 * this route addresses the directory the backend reads and writes.
 * @param raw - the raw segment (a session id).
 * @returns the filesystem-safe segment.
 */
export function encodeSegment(raw) {
	if (typeof raw !== 'string' || raw.length === 0) throw new Error('cannot encode an empty path segment')
	if (raw === '.') return '~002E'
	if (raw === '..') return '~002E~002E'
	let out = ''
	for (let i = 0; i < raw.length; i++) {
		const code = raw.charCodeAt(i)
		const ch = String.fromCharCode(code)
		if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
		else out += '~' + code.toString(16).toUpperCase().padStart(4, '0')
	}
	return out
}

/**
 * Project directory key for one session cwd (backend format.ts `projectKey`).
 * @param cwd - the session's project directory.
 * @returns the `--slug--` directory name.
 */
export function projectKey(cwd) {
	let readable = ''
	let separatorRun = false
	for (let i = 0; i < cwd.length; i++) {
		const code = cwd.charCodeAt(i)
		const ch = String.fromCharCode(code)
		if (ch === '/' || ch === '\\' || ch === ':') {
			if (!separatorRun) readable += '-'
			separatorRun = true
		} else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
			readable += ch
			separatorRun = false
		} else {
			readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
			separatorRun = false
		}
	}
	const slug = readable.replace(/^-+/, '') || 'root'
	return `--${slug.slice(0, 251)}--`
}

/**
 * This deployment's session root directory.
 * @returns the absolute `<DSH_HOME>/sessions` path.
 */
export function sessionsRoot() {
	const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
	return join(home, 'sessions')
}

/**
 * The directory owned by one session, following the backend's convention.
 * @param root - the session root directory.
 * @param cwd - the session's project directory; `undefined` is the `_no-cwd` bucket.
 * @param id - the session id.
 * @returns the absolute session directory.
 */
export function sessionDirFor(root, cwd, id) {
	return join(root, cwd === undefined ? '_no-cwd' : projectKey(cwd), encodeSegment(id))
}

/** True when the path exists as a directory. */
async function isDirectory(target) {
	try {
		return (await stat(target)).isDirectory()
	} catch {
		return false
	}
}

/**
 * Locate one session's directory. The convention above is authoritative; the
 * scan is a fallback for headers whose recorded cwd no longer reproduces the
 * same key (a moved project directory), so a deletion still finds its target.
 * @param root - the session root directory.
 * @param cwd - the session's recorded project directory.
 * @param id - the session id.
 * @returns the directory to remove, or undefined when no directory matches.
 */
export async function locateSessionDir(root, cwd, id) {
	const expected = sessionDirFor(root, cwd, id)
	if (await isDirectory(expected)) return expected
	const segment = encodeSegment(id)
	let projects
	try {
		projects = await readdir(root, { withFileTypes: true })
	} catch {
		return undefined
	}
	for (const entry of projects) {
		if (!entry.isDirectory()) continue
		const candidate = join(root, entry.name, segment)
		if (await isDirectory(candidate)) return candidate
	}
	return undefined
}

/** Read and parse one JSON request body. */
async function readJsonBody(req) {
	const chunks = []
	let size = 0
	for await (const chunk of req) {
		size += chunk.length
		if (size > MAX_BODY_BYTES) throw new Error('request body too large')
		chunks.push(chunk)
	}
	const text = Buffer.concat(chunks).toString('utf8')
	return text.trim() === '' ? {} : JSON.parse(text)
}

/** Write one JSON response. */
function sendJson(res, status, payload) {
	const body = JSON.stringify(payload)
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store',
		'content-length': Buffer.byteLength(body),
	})
	res.end(body)
}

/**
 * Resolve one session's stored header through the query corpus, which is the
 * same live-preferred view the sidebar lists.
 * @param ctx - host context.
 * @param sessionId - the session to resolve.
 * @returns the matching record, or undefined when no such session exists.
 */
async function findRecord(ctx, sessionId) {
	const query = ctx.get('sessionQuery')
	if (query === undefined) return undefined
	const records = await query.listSessions()
	return records.find(record => record.header.id === sessionId)
}

/**
 * Classify an archive rejection: the registry refuses a session that still has
 * activity (`WorkspaceActiveSessionError`) and one it cannot see
 * (`WorkspaceUnknownSessionError`). Anything else stays an internal failure.
 * @param error - the rejection from `archiveSession`.
 * @returns 'active', 'unknown', or 'other'.
 */
function classifyArchiveError(error) {
	const name = typeof error?.name === 'string' && error.name.length > 0
		? error.name
		: (error?.constructor?.name ?? '')
	const message = typeof error?.message === 'string' ? error.message : ''
	if (name.includes('ActiveSession') || /active/i.test(message)) return 'active'
	if (name.includes('UnknownSession') || /unknown/i.test(message)) return 'unknown'
	return 'other'
}

/**
 * One deletion request: archive the session, remove its directory, and relay
 * the removal so the sidebar drops the row.
 * @param ctx - host context.
 * @param req - the HTTP request.
 * @param res - the HTTP response.
 */
async function handleDelete(ctx, req, res) {
	if (req.method !== 'POST') {
		sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'use POST' })
		return
	}
	let payload
	try {
		payload = await readJsonBody(req)
	} catch (error) {
		sendJson(res, 400, { ok: false, code: 'bad-request', message: error instanceof Error ? error.message : String(error) })
		return
	}
	const sessionId = payload?.sessionId
	if (typeof sessionId !== 'string' || sessionId.length === 0) {
		sendJson(res, 400, { ok: false, code: 'bad-request', message: 'sessionId must be a non-empty string' })
		return
	}
	try {
		const registry = ctx.get('workspaceRegistry')
		if (registry === undefined) {
			sendJson(res, 500, { ok: false, code: 'registry-unavailable', message: 'workspace registry is unavailable' })
			return
		}
		// Locate the directory before touching the registry: the archive step
		// refuses an id the registry cannot see, and the log is still on disk.
		const record = await findRecord(ctx, sessionId)
		const path = record === undefined ? undefined : await locateSessionDir(sessionsRoot(), record.header.cwd, sessionId)
		// Archive first. It is the shipped, durable way to take a row out of the
		// sidebar: the archive set is persisted, so a later list refresh cannot
		// bring the row back (deleting the log alone cannot — the session object
		// stays resident and the list is a persistence scan plus live sessions).
		// An already archived id resolves without writing, which keeps a repeat
		// deletion idempotent. Its activity check is the running-turn guard.
		try {
			await registry.archiveSession(sessionId)
		} catch (error) {
			const kind = classifyArchiveError(error)
			if (kind === 'active') {
				sendJson(res, 409, { ok: false, code: 'session-running', message: '该会话正在运行，请先停止后再删除。' })
				return
			}
			if (kind === 'unknown') {
				// Nothing left to delete: the log is gone and the registry lost
				// the id. Still drop the row so a stale entry cannot linger.
				ctx.emit('api-session/removed', sessionId)
				sendJson(res, 200, { ok: true, sessionId, directory: null, alreadyRemoved: true })
				return
			}
			throw error
		}
		if (path !== undefined) await rm(path, { recursive: true, force: true })
		// The row leaves the GUI through the shipped relay the session
		// controller already uses for disposed sessions.
		ctx.emit('api-session/removed', sessionId)
		ctx.logger?.info?.(`dsh-session-delete: removed ${sessionId}${path === undefined ? ' (no log directory)' : ` (${path})`}`)
		sendJson(res, 200, { ok: true, sessionId, directory: path ?? null })
	} catch (error) {
		ctx.logger?.warn?.(`dsh-session-delete: delete failed: ${error instanceof Error ? error.message : String(error)}`)
		sendJson(res, 500, { ok: false, code: 'delete-failed', message: error instanceof Error ? error.message : String(error) })
	}
}

/**
 * Host plugin body: one same-origin route behind the row-menu action.
 * @param ctx - plugin context carrying the `webServer` service.
 */
export function apply(ctx) {
	ctx.inject(['webServer'], (webCtx) => {
		webCtx.effect(() => {
			const dispose = webCtx.webServer.register({
				kind: 'exact',
				path: DELETE_ROUTE,
				handler: (req, res) => { void handleDelete(webCtx, req, res) },
			})
			return () => dispose()
		}, 'dsh-session-delete: web route')
	})
}
