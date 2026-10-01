// @mcf171/dsh-session-delete — browser half (client bundle).
//
// Rendered in the web shell as a static client package (`dsh.client`
// declaration in package.json; served by dsh-client-modules at
// /plugins/@mcf171/dsh-session-delete/client.js). Contributes one row-menu
// entry carrying an inline trash glyph, plus a Ctrl+Shift+Delete accelerator.
//
// Both additions stay inside this bundle: the icon is drawn here and the key
// handler is a plain DOM listener, so the entry depends on nothing beyond
// `react` and cannot fail to activate on a build whose plugin surface differs.
// Selecting either refuses a running session, asks for confirmation, and posts
// to the host route this package's node half owns. No RPC contract is needed:
// the destructive step travels over the same-origin route, exactly as the
// shipped dsh-email plugin talks to its host half.
window.__ModuleLoader__.load({
	id: "@mcf171/dsh-session-delete",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var React = require("react");

		/** Same-origin route owned by this package's host half. */
		const ROUTE = "/_dsh/dsh-session-delete/delete";

		// --- styles (module scope, mirroring compiled client bundles) ---
		// Metrics copied from the shipped menu row (ui-primitives Menu.module.css
		// `.item`: flex, 34px min height, 6px/8px padding, 13px/20px text) so this
		// entry sits in the menu at the same size as rename/fork/archive. Only the
		// label colour differs, because deletion is destructive.
		const CSS_ID = "dsh-session-delete/client.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-session-delete";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = [
				".dshsd-delete{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md,6px);background:transparent;cursor:pointer;font-size:13px;line-height:20px;text-align:left;color:var(--dsw-alias-state-error-primary,#d92d20)}",
				".dshsd-delete:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}",
				".dshsd-delete:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));outline:none}",
				".dshsd-delete:disabled{opacity:.5;cursor:default}",
				".dshsd-delete svg{flex:none}"
			].join("");
			document.head.appendChild(tag);
		}

		/**
		 * Trash glyph, drawn inline in the same 14px box the shipped icons occupy.
		 * Keeping it in this bundle means the entry needs no icon package.
		 * @returns the icon element.
		 */
		function TrashGlyph() {
			return React.createElement(
				"svg",
				{ width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
				React.createElement("path", {
					d: "M6 2.5h4M3.5 5.5h9M5.5 5.5l.5 8a1 1 0 0 0 1 .9h2a1 1 0 0 0 1-.9l.5-8M7 8v4M9 8v4",
					stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round"
				})
			);
		}

		/** Dismissal-safe locale read: the slot seat is the workspace namespace, so fall back to copy. */
		function label(t, key, fallback) {
			if (typeof t !== "function") return fallback;
			try {
				const value = t(key);
				return typeof value === "string" && value.length > 0 && value !== key ? value : fallback;
			} catch {
				return fallback;
			}
		}

		/** One session's live row state, read from the client session list. */
		function rowState(ctx, sessionId) {
			try {
				const snapshot = ctx.sessions?.list?.getSnapshot?.();
				return snapshot?.byId?.[sessionId];
			} catch {
				return undefined;
			}
		}

		/** POST one deletion and return the host's JSON answer. */
		async function postDelete(sessionId) {
			const response = await fetch(ROUTE, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ sessionId })
			});
			let payload = null;
			try {
				payload = await response.json();
			} catch {
				payload = null;
			}
			if (response.ok !== true || payload?.ok !== true) {
				throw new Error(payload?.message ?? ("delete failed (HTTP " + response.status + ")"));
			}
			return payload;
		}

		/** The whole user-facing flow behind one menu selection or one key press. */
		async function runDelete(ctx, sessionId, displayTitle, t) {
			const state = rowState(ctx, sessionId);
			if (state?.running === true) {
				window.alert(label(t, "delete.running", "该会话正在运行，请先停止后再删除。"));
				return;
			}
			const title = typeof displayTitle === "string" && displayTitle.length > 0 ? displayTitle : sessionId;
			const question = label(t, "delete.confirm", "将永久删除会话「{title}」及其全部记录，此操作不可撤销。").split("{title}").join(title);
			if (window.confirm(question) !== true) return;
			try {
				await postDelete(sessionId);
				// Deliberately no sessions.refresh() here. The host keeps the
				// session object resident until the process restarts, and its list
				// is a persistence scan plus those live sessions — so refreshing
				// right after a delete immediately re-adds the row that was just
				// removed. The host archives the id and broadcasts
				// `api-session/removed`; that pairing is what clears the sidebar.
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				window.alert(label(t, "delete.failed", "删除失败：") + message);
			}
		}

		/**
		 * The session the accelerator acts on: the one the main view holds, read
		 * the same way the sidebar derives its current row.
		 * @param ctx - plugin context.
		 * @returns the current row summary, or undefined when none is selected.
		 */
		function currentSession(ctx) {
			try {
				const snapshot = ctx.sessions?.list?.getSnapshot?.();
				const rows = Object.values(snapshot?.byId ?? {});
				return rows.find(row => (row?.retainedBy?.mainView ?? 0) > 0);
			} catch {
				return undefined;
			}
		}

		/**
		 * True while the user is typing, so the accelerator never steals a key
		 * from an editor.
		 * @returns whether the focused element accepts text.
		 */
		function isTypingTarget() {
			const active = typeof document === "undefined" ? null : document.activeElement;
			if (active === null || active === undefined) return false;
			if (active.isContentEditable === true) return true;
			return active.tagName === "INPUT" || active.tagName === "TEXTAREA";
		}

		/** Plugin body: dictionaries, the row-menu entry, and the key listener. */
		function apply(ctx) {
			/**
			 * Menu row: permanently delete this session. A running session is
			 * refused with a notice; otherwise one confirmation gates the call.
			 * Defined inside apply so the entry closes over this plugin's ctx.
			 * @param props - owner share (sessionId, displayTitle), the menu open
			 *   state, and the locale seat.
			 */
			function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, t }) {
				const [, setMenuOpen] = useMenuOpenState();
				const [busy, setBusy] = React.useState(false);
				const onSelect = React.useCallback(() => {
					setMenuOpen(false);
					setBusy(true);
					void runDelete(ctx, sessionId, displayTitle, t).finally(() => { setBusy(false); });
				}, [sessionId, displayTitle, setMenuOpen, t]);
				return React.createElement("button", {
					type: "button",
					role: "menuitem",
					className: "dshsd-delete",
					disabled: busy,
					onClick: onSelect
				}, React.createElement(TrashGlyph), React.createElement("span", null, label(t, "menu.deleteSession", "删除会话")));
			}
			ctx.effect(() => {
				const disposeZh = ctx.locale.register("dsh-session-delete", "zh", {
					"menu.deleteSession": "删除会话",
					"delete.confirm": "将永久删除会话「{title}」及其全部记录，此操作不可撤销。",
					"delete.running": "该会话正在运行，请先停止后再删除。",
					"delete.failed": "删除失败："
				});
				const disposeEn = ctx.locale.register("dsh-session-delete", "en", {
					"menu.deleteSession": "Delete session",
					"delete.confirm": "This permanently deletes \"{title}\" and all of its records. This cannot be undone.",
					"delete.running": "This session is running. Stop it before deleting.",
					"delete.failed": "Delete failed: "
				});
				return () => {
					disposeZh();
					disposeEn();
				};
			}, "dsh-session-delete: locale dictionaries");
			ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
				name: "sidebar.workspaces.session.menu.item",
				id: "dsh-session-delete.delete",
				order: 900,
				locale: "dsh-session-delete"
			}, DeleteSessionMenuItem));
			// Ctrl+Shift+Delete (Cmd+Shift+Delete on macOS): a plain DOM listener
			// driving the same runDelete flow, so the accelerator adds no dependency
			// and cannot keep this entry from activating. A modifier chord (never a
			// bare Delete) guards an action that cannot be undone.
			ctx.effect(() => {
				if (typeof document === "undefined") return () => { };
				const onKeyDown = (event) => {
					if (event.defaultPrevented === true) return;
					if (event.code !== "Delete") return;
					if (event.shiftKey !== true) return;
					if (event.ctrlKey !== true && event.metaKey !== true) return;
					if (isTypingTarget()) return;
					const target = currentSession(ctx);
					if (target === undefined) return;
					event.preventDefault();
					void runDelete(ctx, target.id, target.displayTitle ?? target.id, undefined);
				};
				document.addEventListener("keydown", onKeyDown);
				return () => { document.removeEventListener("keydown", onKeyDown); };
			}, "dsh-session-delete: key listener");
		}

		module.exports = { name: "@mcf171/dsh-session-delete", inject: ["slots", "sessions", "locale"], apply };
		return module.exports;
	}
});
