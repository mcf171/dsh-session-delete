// Offline harness for the client half: loads lib/client.js the way the web
// shell does, registers it against a fake slot registry, renders the menu item
// and fires its click handler. Reports every step so a silent click failure
// (the reported symptom) becomes a concrete error here.
//
//   node test/client-check.mjs
let definition = null
const styleTags = []

globalThis.window = {
	__ModuleLoader__: { load: (def) => { definition = def } },
	alert: (message) => { log.push(`ALERT: ${message}`) },
	confirm: (message) => { log.push(`CONFIRM: ${message}`); return confirmAnswer },
	setTimeout: (fn) => { fn(); return 0 },
}
const log = []
let confirmAnswer = false

globalThis.document = {
	querySelector: () => null,
	createElement: () => ({ dataset: {}, style: {}, textContent: '', appendChild() { }, setAttribute() { } }),
	head: { appendChild: (tag) => { styleTags.push(tag) } },
}

const React = {
	createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
	useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => { }],
	useCallback: (fn) => fn,
}
const require = (name) => {
	if (name === 'react') return React
	throw new Error(`unexpected require("${name}")`)
}

await import('../lib/client.js')
console.log(`1. module loader received a definition: ${definition !== null}`)
if (definition === null) process.exit(1)
console.log(`   id = ${definition.id}`)

const mod = definition.factory(require)
console.log(`2. factory exports: name=${mod.name} inject=[${mod.inject}] apply=${typeof mod.apply}`)

let registered = null
let fetched = null
globalThis.fetch = async (url, options) => {
	fetched = { url, options }
	return {
		ok: true,
		status: 200,
		json: async () => ({ ok: true, sessionId: 'session-probe', directory: 'X:/probe', live: false }),
	}
}

const ctx = {
	effect: (fn) => { fn(); return () => { } },
	locale: { register: () => () => { } },
	slots: {
		inject: (name, callback) => { console.log(`3. slots.inject("${name}")`); callback() },
		register: (spec, Component) => { registered = { spec, Component }; console.log(`4. slots.register id=${spec.id} order=${spec.order} locale=${spec.locale}`) },
	},
	sessions: {
		list: { getSnapshot: () => ({ byId: { 'session-probe': { running: false } } }) },
		refresh: async () => { log.push('REFRESH called') },
	},
}

mod.apply(ctx)
console.log(`5. registered: ${registered !== null}; styles injected: ${styleTags.length}`)
if (registered === null) process.exit(1)

// --- render ---
const Component = registered.Component
let menuClosed = false
const props = {
	sessionId: 'session-probe',
	displayTitle: '询问AI是否支持识图',
	useMenuOpenState: () => [true, (open) => { if (open === false) menuClosed = true }],
	t: (key) => key,
}
let element
try {
	element = Component(props)
	console.log(`6. rendered element: ${element.type}, label=${JSON.stringify(element.children)}`)
} catch (error) {
	console.log(`6. RENDER FAILED: ${error.message}`)
	process.exit(1)
}

// --- click: cancel path ---
confirmAnswer = false
try {
	element.props.onClick()
	await new Promise(resolve => setTimeout(resolve, 20))
	console.log(`7. click (cancelled): menuClosed=${menuClosed} confirmShown=${log.some(entry => entry.startsWith('CONFIRM'))} fetchCalled=${fetched !== null}`)
} catch (error) {
	console.log(`7. CLICK FAILED: ${error.message}`)
}

// --- click: confirm path ---
confirmAnswer = true
menuClosed = false
try {
	element.props.onClick()
	await new Promise(resolve => setTimeout(resolve, 50))
	console.log(`8. click (confirmed): fetch=${fetched === null ? 'NOT CALLED' : fetched.url}`)
	console.log(`   body=${fetched?.options?.body}`)
	console.log(`   log=${JSON.stringify(log)}`)
} catch (error) {
	console.log(`8. CLICK FAILED: ${error.message}`)
}

// --- running session guard ---
ctx.sessions.list.getSnapshot = () => ({ byId: { 'session-probe': { running: true } } })
log.length = 0
fetched = null
try {
	Component(props).props.onClick()
	await new Promise(resolve => setTimeout(resolve, 20))
	console.log(`9. running guard: fetch=${fetched === null ? 'not called (correct)' : 'CALLED (wrong)'} log=${JSON.stringify(log)}`)
} catch (error) {
	console.log(`9. GUARD FAILED: ${error.message}`)
}
