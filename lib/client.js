// @mcf171/dsh-session-delete — browser half (client bundle).
//
// Rendered in the web shell as a static client package (`dsh.client`
// declaration in package.json; served by dsh-client-modules at
// /plugins/@mcf171/dsh-session-delete/client.js). Contributes two things:
//
//   sidebar.workspaces.session.menu.item → a "delete session" row carrying the
//     shipped trash icon and the command's key hint;
//   session.delete → the Ctrl+Shift+Delete command (primary+shift+Delete),
//     which acts on the current session through the same confirmation flow.
//
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

		// The shipped primitives supply the row metrics, the trash glyph and the
		// shortcut hint, so this entry matches rename/fork/archive. A build whose
		// export map differs must not take the plugin down: the require is guarded
		// and the entry degrades to a plain button with an inline glyph.
		let primitives = null;
		try { primitives = require("@deepseek-ai/dsh-client-ui-primitives/client"); } catch { primitives = null; }
		const MenuItemButton = typeof primitives?.MenuItemButton === "function" ? primitives.MenuItemButton : null;
		const ShippedTrashIcon = typeof primitives?.IconTrashOutlineRegular === "function" ? primitives.IconTrashOutlineRegular : null;

		/** Same-origin route owned by this package's host half. */
		const ROUTE = "/_dsh/dsh-session-delete/delete";
		/** Command id shared by the key binding and the row's hint. */
		const SHORTCUT_ID = "session.delete";

		// --- styles (module scope, mirroring compiled client bundles) ---
		// Metric-for-metric the shipped menu row (ui-primitives Menu.module.css
		// `.item`: flex, 34px min height, 6px/8px padding, 13px/20px text), so this
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
				".dshsd-delete:disabled{opacity:.5;cursor:default}"
			].join("");
			document.head.appendChild(tag);
		}

		/**
		 * The row's leading glyph: the shipped trash outline, or an inline
		 * equivalent in the same 14px box when the primitives package is absent.
		 * @returns the icon element.
		 */
		function trashIcon() {
			if (ShippedTrashIcon !== null) return React.createElement(ShippedTrashIcon, { size: 14 });
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

		/** The whole user-facing flow behind one menu selection. */
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
		 * The session the keyboard command acts on: the one the main view holds,
		 * read exactly as the shipped row commands read it.
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

		/** Plugin body: dictionaries, the keyboard command, and the row-menu entry. */
		function apply(ctx) {
			/**
			 * Menu row: permanently delete this session. A running session is
			 * refused with a notice; otherwise one confirmation gates the call.
			 * Defined inside apply so the entry closes over this plugin's ctx.
			 * @param props - owner share (sessionId, displayTitle), the menu open
			 *   state, and the locale seat.
			 */
			function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, useShortcuts, t }) {
				const [, setMenuOpen] = useMenuOpenState();
				const [busy, setBusy] = React.useState(false);
				// Same key hint the shipped entries render; the hook is absent on a
				// build that does not publish it.
				const shortcut = typeof useShortcuts === "function"
					? useShortcuts(rows => rows.find(row => row.id === SHORTCUT_ID))
					: undefined;
				const onSelect = React.useCallback(() => {
					setMenuOpen(false);
					setBusy(true);
					void runDelete(ctx, sessionId, displayTitle, t).finally(() => { setBusy(false); });
				}, [sessionId, displayTitle, setMenuOpen, t]);
				const text = label(t, "menu.deleteSession", "删除会话");
				if (MenuItemButton !== null) {
					return React.createElement(MenuItemButton, {
						shortcut,
						icon: trashIcon(),
						onSelect
					}, text);
				}
				return React.createElement("button", {
					type: "button",
					role: "menuitem",
					className: "dshsd-delete",
					disabled: busy,
					onClick: onSelect
				}, trashIcon(), React.createElement("span", null, text));
			}
			ctx.effect(() => {
				const disposeZh = ctx.locale.register("dsh-session-delete", "zh", {
					"menu.deleteSession": "删除会话",
					"delete.confirm": "将永久删除会话「{title}」及其全部记录，此操作不可撤销。",
					"delete.running": "该会话正在运行，请先停止后再删除。",
					"delete.liveNotice": "已从磁盘删除该会话。它当前仍处于打开状态，重启 DSH 后彻底消失。",
					"delete.failed": "删除失败：",
					"shortcut.noSession": "没有选中的会话"
				});
				const disposeEn = ctx.locale.register("dsh-session-delete", "en", {
					"menu.deleteSession": "Delete session",
					"delete.confirm": "This permanently deletes \"{title}\" and all of its records. This cannot be undone.",
					"delete.running": "This session is running. Stop it before deleting.",
					"delete.liveNotice": "Removed from disk. The session is still open in this process; it disappears for good after DSH restarts.",
					"delete.failed": "Delete failed: ",
					"shortcut.noSession": "No session is selected"
				});
				return () => {
					disposeZh();
					disposeEn();
				};
			}, "dsh-session-delete: locale dictionaries");
			// Ctrl+Shift+Delete (primary+shift+Delete). Deletion cannot be undone, so
			// it takes a modifier chord like the shipped archive binding rather than a
			// bare Delete key. Profiles mirror the shipped registrations.
			const commandText = ctx.locale.bind("dsh-session-delete");
			// Read the capability defensively instead of declaring it as a hard inject
			// edge: a build without the shortcut service must still deliver the row
			// menu, and losing only the key binding is the acceptable degradation.
			const shortcuts = ctx.get?.("shortcuts") ?? ctx.shortcuts;
			if (shortcuts !== undefined) ctx.effect(() => shortcuts.register({
				id: SHORTCUT_ID,
				label: () => label(commandText, "menu.deleteSession", "删除会话"),
				aliases: ["delete session", "remove session"],
				defaults: {
					"desktop:macos": { code: "Delete", modifiers: ["primary", "shift"] },
					"desktop:windows": { code: "Delete", modifiers: ["primary", "shift"] },
					"desktop:linux": { code: "Delete", modifiers: ["primary", "shift"] },
					"web:macos": { code: "Delete", modifiers: ["primary", "shift"] },
					"web:windows": { code: "Delete", modifiers: ["primary", "shift"] }
				},
				regions: ["page", "editable"],
				modals: [],
				resolve: () => {
					const target = currentSession(ctx);
					if (target === undefined) {
						return { status: "blocked", reason: label(commandText, "shortcut.noSession", "没有选中的会话") };
					}
					return {
						status: "handled",
						run: () => { void runDelete(ctx, target.id, target.displayTitle ?? target.id, commandText) }
					};
				}
			}), "dsh-session-delete: session.delete command");
			ctx.slots.inject("sidebar.workspaces.session.menu.item", () => ctx.slots.register({
				name: "sidebar.workspaces.session.menu.item",
				id: "dsh-session-delete.delete",
				order: 900,
				locale: "dsh-session-delete"
			}, DeleteSessionMenuItem));
		}

		module.exports = { name: "@mcf171/dsh-session-delete", inject: ["slots", "sessions", "locale"], apply };
		return module.exports;
	}
});
