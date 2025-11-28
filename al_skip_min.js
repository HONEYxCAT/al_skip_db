!(function () {
	"use strict";
	const t = "https://raw.githubusercontent.com/HONEYxCAT/al_skip_db/refs/heads/main/database/",
		e = ["http://online3.skaz.tv/", "http://online4.skaz.tv/", "http://online5.skaz.tv/"],
		a = e[Math.floor(Math.random() * e.length)],
		n = (t) => new Promise((e) => setTimeout(e, t));
	function i(t, e) {
		t &&
			"object" == typeof t &&
			(t.segments || (t.segments = {}),
			t.segments.skip || (t.segments.skip = []),
			e.forEach((e) => {
				t.segments.skip.some((t) => t.start === e.start) || t.segments.skip.push({ start: e.start, end: e.end, name: e.name || "Пропустить" });
			}));
	}
	function s(t, e, a) {
		if (!t) return null;
		const n = String(e),
			i = String(a);
		return t[n] && t[n][i] ? t[n][i] : ("1" === n && "1" === i && t.movie) || t.movie ? t.movie : null;
	}
	function r(t) {
		let e = Lampa.Storage.get("lampac_unic_id", ""),
			a = Lampa.Storage.get("account_email", "");
		e || ((e = Lampa.Utils.uid(8).toLowerCase()), Lampa.Storage.set("lampac_unic_id", e));
		const n = (t, e) => t + (t.indexOf("?") >= 0 ? "&" : "?") + e;
		return (-1 === (t += "").indexOf("account_email=") && (t = n(t, "account_email=" + encodeURIComponent(a))), -1 === t.indexOf("uid=") && (t = n(t, "uid=" + encodeURIComponent(e))), -1 === t.indexOf("token=") && (t = n(t, "token=")), t);
	}
	async function o(t) {
		try {
			const e = await fetch(t);
			if (!e.ok) throw new Error(`HTTP error! status: ${e.status}`);
			return await e.text();
		} catch (t) {
			throw t;
		}
	}
	async function l(e) {
		let l = e.movie || e.card;
		if (!l) {
			const t = Lampa.Activity.active();
			t && (l = t.movie || t.card);
		}
		if (!l) return;
		const c = l.kinopoisk_id || ("kinopoisk" === l.source ? l.id : null) || l.kp_id;
		let u = e.episode || e.e || e.episode_number || 1,
			m = e.season || e.s || 1;
		if ((l.number_of_seasons > 0 || (l.original_name && !l.original_title) || ((m = 1), (u = 1)), c)) {
			const a = await (async function (e) {
				try {
					const a = `${t}${e}.json`,
						n = await fetch(a);
					return n.ok ? await n.json() : null;
				} catch (t) {
					return null;
				}
			})(c);
			if (a) {
				const t = s(a, m, u);
				return (
					t && i(e, t),
					void (
						e.playlist &&
						Array.isArray(e.playlist) &&
						e.playlist.forEach((t) => {
							let e = t.season || t.s || m,
								n = t.episode || t.e || t.episode_number;
							if (e && n) {
								const r = s(a, e, n);
								r && i(t, r);
							}
						})
					)
				);
			}
		}
		const d = await (async function (t, e, i) {
			const s = t.title || t.name,
				l = t.original_title || t.original_name,
				c = (t.release_date || t.first_air_date || "0000").slice(0, 4),
				u = { id: t.id, imdb_id: t.imdb_id || "", kinopoisk_id: t.kinopoisk_id || "", title: s, original_title: l, year: c, serial: t.number_of_seasons || e > 0 ? 1 : 0, source: "tmdb", life: !0 },
				m = Object.keys(u)
					.map((t) => `${t}=${encodeURIComponent(u[t])}`)
					.join("&");
			try {
				let t = r(`${a}lite/events?${m}`),
					s = await o(t),
					l = JSON.parse(s),
					c = null;
				if (l.life && l.memkey) {
					const t = 7500,
						e = 250,
						i = Math.ceil(t / e);
					for (let t = 1; t <= i; t++) {
						await n(e);
						const t = r(`${a}lifeevents?memkey=${l.memkey}&${m}`);
						try {
							let e = await o(t),
								a = JSON.parse(e);
							const n = (Array.isArray(a) ? a : a.online || []).find((t) => t.name && t.name.toLowerCase().includes("alloha"));
							if (n) {
								c = n;
								break;
							}
						} catch (t) {}
					}
				} else c = (Array.isArray(l) ? l : l.online || []).find((t) => t.name && t.name.toLowerCase().includes("alloha"));
				if (!c) return null;
				let u = r(`${c.url}${c.url.includes("?") ? "&" : "?"}${m}`),
					d = 0;
				for (; d < 5; ) {
					d++;
					const t = await o(u);
					let a = !1,
						n = null;
					if (t.trim().startsWith("{") || t.trim().startsWith("["))
						try {
							((n = JSON.parse(t)), (a = !0));
						} catch (t) {}
					if (a) {
						if (n.segments) return n.segments;
						if (n.url && !n.playlist) {
							u = r(n.url);
							continue;
						}
					}
					const s = new DOMParser().parseFromString(t, "text/html").querySelectorAll(".videos__item");
					if (0 === s.length && !a) break;
					let l = null;
					const c = (t) => (t || "").toLowerCase().trim(),
						m = (t) => {
							const e = c(t).match(/(\d+)/);
							return e ? parseInt(e[1], 10) : null;
						};
					for (let t = 0; t < s.length; t++) {
						const a = s[t],
							n = a.getAttribute("s"),
							r = a.getAttribute("e"),
							o = c(a.textContent);
						if (n && r) {
							if (n == e && r == i) {
								l = a;
								break;
							}
						} else if (n) {
							if (n == e) {
								l = a;
								break;
							}
						} else {
							if (o.includes("сезон") && m(o) == e) {
								l = a;
								break;
							}
							if (o.includes("серия") && m(o) == i) {
								l = a;
								break;
							}
						}
					}
					if (!l) {
						const t = c(s[0].textContent);
						if (t.includes("сезон") || t.includes("серия") || s[0].hasAttribute("s") || s[0].hasAttribute("e")) break;
						l = s[0];
					}
					const p = l.getAttribute("data-json");
					if (!p) break;
					try {
						const t = JSON.parse(p);
						if (!t || !t.url) break;
						u = r(t.url);
					} catch (t) {
						break;
					}
				}
			} catch (t) {}
			return null;
		})(l, m, u);
		if (d) {
			const t = (p = d) && p.skip && Array.isArray(p.skip) ? p.skip.filter((t) => null != t.start && null != t.end).map((t) => ({ start: t.start, end: t.end, name: "Пропустить" })) : [];
			t.length > 0 &&
				(i(e, t),
				e.playlist &&
					Array.isArray(e.playlist) &&
					e.playlist.forEach((e) => {
						e.episode == u && e.season == m && i(e, t);
					}));
		}
		var p;
	}
	function c() {
		if (window.lampa_alloha_skip_combined) return;
		window.lampa_alloha_skip_combined = !0;
		const t = Lampa.Player.play;
		Lampa.Player.play = function (e) {
			const a = this;
			(Lampa.Loading.start(() => {
				(Lampa.Loading.stop(), t.call(a, e));
			}),
				l(e)
					.then(() => {
						(Lampa.Loading.stop(), t.call(a, e));
					})
					.catch((n) => {
						(Lampa.Loading.stop(), t.call(a, e));
					}));
		};
	}
	window.Lampa && window.Lampa.Player ? c() : window.document.addEventListener("app_ready", c);
})();
