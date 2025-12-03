!(function () {
	"use strict";
	const e = "https://raw.githubusercontent.com/HONEYxCAT/al_skip_db/refs/heads/main/database/",
		t = ["http://online3.skaz.tv/", "http://online4.skaz.tv/", "http://online5.skaz.tv/"],
		n = t[Math.floor(Math.random() * t.length)],
		i = "https://api.aniskip.com/v2/skip-times",
		a = "https://api.jikan.moe/v4/anime",
		s = ["op", "ed", "recap", "mixed-op", "mixed-ed"],
		r = (e) => new Promise((t) => setTimeout(t, e));
	function o(e, t = !1) {
		(console.log("[UltimateSkip]: " + e), t && "undefined" != typeof Lampa && Lampa.Noty);
	}
	function l(e, t) {
		if (!e || "object" != typeof e) return 0;
		(e.segments || (e.segments = {}), e.segments.skip || (e.segments.skip = []));
		let n = 0;
		return (
			t.forEach((t) => {
				e.segments.skip.some((e) => e.start === t.start) || (e.segments.skip.push({ start: t.start, end: t.end, name: t.name || "Пропустить" }), n++);
			}),
			n
		);
	}
	function c(e, t, n, i) {
		e &&
			Array.isArray(e) &&
			e.forEach((e) => {
				const a = e.season || e.s || t;
				(e.episode || e.e || e.episode_number) == n && a == t && l(e, i);
			});
	}
	function m(e, t, n) {
		if (!e) return null;
		const i = String(t),
			a = String(n);
		return e[i] && e[i][a] ? e[i][a] : ("1" === i && "1" === a && e.movie) || e.movie ? e.movie : null;
	}
	function u(e) {
		let t = Lampa.Storage.get("lampac_unic_id", ""),
			n = Lampa.Storage.get("account_email", "");
		t || ((t = Lampa.Utils.uid(8).toLowerCase()), Lampa.Storage.set("lampac_unic_id", t));
		const i = (e, t) => e + (e.indexOf("?") >= 0 ? "&" : "?") + t;
		return (-1 === (e += "").indexOf("account_email=") && (e = i(e, "account_email=" + encodeURIComponent(n))), -1 === e.indexOf("uid=") && (e = i(e, "uid=" + encodeURIComponent(t))), -1 === e.indexOf("token=") && (e = i(e, "token=")), e);
	}
	async function p(e) {
		try {
			const t = await fetch(e);
			if (!t.ok) throw new Error(`HTTP error! status: ${t.status}`);
			return await t.text();
		} catch (e) {
			throw e;
		}
	}
	async function d(t) {
		let d = t.movie || t.card;
		if (!d) {
			const e = Lampa.Activity.active();
			e && (d = e.movie || e.card);
		}
		if (!d) return;
		const f = d.kinopoisk_id || ("kinopoisk" === d.source ? d.id : null) || d.kp_id;
		let k = t.episode || t.e || t.episode_number || 1,
			g = t.season || t.s || 1;
		if ((d.number_of_seasons > 0 || (d.original_name && !d.original_title) || ((g = 1), (k = 1)), o(`Start search for: ${d.title} (S${g} E${k})`), f)) {
			const n = await (async function (t) {
				try {
					const n = `${e}${t}.json`,
						i = await fetch(n);
					return i.ok ? await i.json() : null;
				} catch (e) {
					return null;
				}
			})(f);
			if (n) {
				o(`[Success] Found in GitHub DB (KP: ${f})`);
				const e = m(n, g, k);
				return (
					e && (l(t, e), Lampa.Noty.show("Таймкоды загружены (GitHub)")),
					void (
						t.playlist &&
						Array.isArray(t.playlist) &&
						t.playlist.forEach((e) => {
							let t = e.season || e.s || g,
								i = e.episode || e.e || e.episode_number;
							if (t && i) {
								const a = m(n, t, i);
								a && l(e, a);
							}
						})
					)
				);
			}
		}
		o("GitHub failed, checking for Anime criteria...");
		const h = (d.original_language || "").toLowerCase(),
			y = "ja" === h || "zh" === h || "cn" === h,
			w = d.genres && d.genres.some((e) => 16 === e.id || (e.name && "animation" === e.name.toLowerCase()));
		if (y || w) {
			o("Anime criteria matched. Trying AniSkip...");
			const e = (_ = d.original_name || d.original_title || d.name)
					? _.replace(/\(\d{4}\)/g, "")
							.replace(/\(TV\)/gi, "")
							.replace(/Season \d+/gi, "")
							.replace(/Part \d+/gi, "")
							.replace(/[:\-]/g, " ")
							.replace(/\s+/g, " ")
							.trim()
					: "",
				n = await (async function (e, t) {
					let n = e;
					t > 1 && (n += " Season " + t);
					const i = `${a}?q=${encodeURIComponent(n)}&limit=5`;
					try {
						const e = await fetch(i),
							t = await e.json();
						return t.data && 0 !== t.data.length ? t.data[0].mal_id : null;
					} catch (e) {
						return (o("Jikan Error: " + e.message), null);
					}
				})(e, g);
			if (n) {
				const e = await (async function (e, t) {
						const n = s.map((e) => "types=" + e);
						n.push("episodeLength=0");
						const a = `${i}/${e}/${t}?${n.join("&")}`;
						try {
							const e = await fetch(a);
							if (404 === e.status) return [];
							const t = await e.json();
							return (t.found && t.results) || [];
						} catch (e) {
							return [];
						}
					})(n, k),
					a = (function (e) {
						if (!e || !e.length) return [];
						const t = [];
						return (
							e.forEach((e) => {
								if (!e.interval) return;
								const n = (e.skipType || e.skip_type || "").toLowerCase();
								let i = "Пропустить";
								n.includes("op") ? (i = "Опенинг") : n.includes("ed") ? (i = "Эндинг") : "recap" === n && (i = "Рекап");
								const a = void 0 !== e.interval.startTime ? e.interval.startTime : e.interval.start_time,
									s = void 0 !== e.interval.endTime ? e.interval.endTime : e.interval.end_time;
								void 0 !== a && void 0 !== s && t.push({ start: a, end: s, name: i });
							}),
							t
						);
					})(e);
				if (a.length > 0) return (o("[Success] Found in AniSkip"), l(t, a), c(t.playlist, g, k, a), Lampa.Noty.show("Таймкоды загружены (AniSkip)"), void (window.Lampa.Player.listener && window.Lampa.Player.listener.send("segments", { skip: t.segments.skip })));
				o("AniSkip returned no segments.");
			} else o("Jikan ID not found.");
			return void o("Skipping Skaz because content is identified as Anime.");
		}
		var _;
		(o("Not an Anime (Language/Genre mismatch). Skipping AniSkip."), o("AniSkip failed, trying Skaz..."));
		const L = await (async function (e, t, i) {
			const a = e.title || e.name,
				s = e.original_title || e.original_name,
				o = (e.release_date || e.first_air_date || "0000").slice(0, 4),
				l = { id: e.id, imdb_id: e.imdb_id || "", kinopoisk_id: e.kinopoisk_id || "", title: a, original_title: s, year: o, serial: e.number_of_seasons || t > 0 ? 1 : 0, source: "tmdb", life: !0 },
				c = Object.keys(l)
					.map((e) => `${e}=${encodeURIComponent(l[e])}`)
					.join("&");
			try {
				let a = u(`${n}lite/events?${c}`),
					s = await p(a),
					o = JSON.parse(s),
					l = null;
				if (o.life && o.memkey) {
					const t = 7500,
						i = 250,
						a = Math.ceil(t / i);
					for (let t = 1; t <= a; t++) {
						await r(i);
						const t = u(`${n}lifeevents?memkey=${o.memkey}&${c}`);
						try {
							let e = await p(t),
								n = JSON.parse(e);
							const i = (Array.isArray(n) ? n : n.online || []).find((e) => e.name && e.name.toLowerCase().includes("alloha"));
							if (i) {
								l = i;
								break;
							}
						} catch (e) {}
					}
				} else l = (Array.isArray(o) ? o : o.online || []).find((e) => e.name && e.name.toLowerCase().includes("alloha"));
				if (!l) return null;
				let m = u(`${l.url}${l.url.includes("?") ? "&" : "?"}${c}`),
					d = 0;
				for (; d < 5; ) {
					d++;
					const n = await p(m);
					let a = !1,
						s = null;
					if (n.trim().startsWith("{") || n.trim().startsWith("["))
						try {
							((s = JSON.parse(n)), (a = !0));
						} catch (e) {}
					if (a) {
						if (s.segments) return s.segments;
						if (s.url && !s.playlist) {
							m = u(s.url);
							continue;
						}
					}
					const r = new DOMParser().parseFromString(n, "text/html").querySelectorAll(".videos__item");
					if (0 === r.length && !a) break;
					let o = null;
					const l = (e) => (e || "").toLowerCase().trim(),
						c = (e) => {
							const t = l(e).match(/(\d+)/);
							return t ? parseInt(t[1], 10) : null;
						};
					for (let e = 0; e < r.length; e++) {
						const n = r[e],
							a = n.getAttribute("s"),
							s = n.getAttribute("e"),
							m = l(n.textContent);
						if (a && s) {
							if (a == t && s == i) {
								o = n;
								break;
							}
						} else if (a) {
							if (a == t) {
								o = n;
								break;
							}
						} else {
							if (m.includes("сезон") && c(m) == t) {
								o = n;
								break;
							}
							if (m.includes("серия") && c(m) == i) {
								o = n;
								break;
							}
						}
					}
					if (!o) {
						const e = l(r[0].textContent);
						if (e.includes("сезон") || e.includes("серия") || r[0].hasAttribute("s") || r[0].hasAttribute("e")) break;
						o = r[0];
					}
					const f = o.getAttribute("data-json");
					if (!f) break;
					try {
						const e = JSON.parse(f);
						if (!e || !e.url) break;
						m = u(e.url);
					} catch (e) {
						break;
					}
				}
			} catch (e) {}
			return null;
		})(d, g, k);
		if (L) {
			const e = (S = L) && S.skip && Array.isArray(S.skip) ? S.skip.filter((e) => null != e.start && null != e.end).map((e) => ({ start: e.start, end: e.end, name: "Пропустить" })) : [];
			if (e.length > 0) return (o("[Success] Found in Skaz"), l(t, e), c(t.playlist, g, k, e), void Lampa.Noty.show("Таймкоды загружены (Skaz)"));
		}
		var S;
	}
	function f() {
		if (window.lampa_ultimate_skip) return;
		window.lampa_ultimate_skip = !0;
		const e = Lampa.Player.play;
		((Lampa.Player.play = function (t) {
			const n = this;
			(Lampa.Loading.start(() => {
				(Lampa.Loading.stop(), e.call(n, t));
			}),
				d(t)
					.then(() => {
						(Lampa.Loading.stop(), e.call(n, t));
					})
					.catch((i) => {
						(console.error("[UltimateSkip] Critical Error:", i), Lampa.Loading.stop(), e.call(n, t));
					}));
		}),
			console.log("[UltimateSkip] Combined Plugin Loaded (DB -> AniSkip -> Skaz)"));
	}
	window.Lampa && window.Lampa.Player ? f() : window.document.addEventListener("app_ready", f);
})();
