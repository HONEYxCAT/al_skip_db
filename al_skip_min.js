!(function () {
	"use strict";
	const e = "https://raw.githubusercontent.com/HONEYxCAT/al_skip_db/refs/heads/main/database/",
		t = ["http://online3.skaz.tv/", "http://online4.skaz.tv/", "http://online5.skaz.tv/"],
		i = t[Math.floor(Math.random() * t.length)],
		n = "https://api.aniskip.com/v2/skip-times",
		a = "https://api.jikan.moe/v4/anime",
		o = ["op", "ed", "recap"],
		s = (e) => new Promise((t) => setTimeout(t, e));
	function l(e, t = !1) {
		(console.log("[UltimateSkip]: " + e), t && "undefined" != typeof Lampa && Lampa.Noty);
	}
	function r(e, t) {
		if (!e || "object" != typeof e) return 0;
		(e.segments || (e.segments = {}), e.segments.skip || (e.segments.skip = []));
		let i = 0;
		return (
			t.forEach((t) => {
				e.segments.skip.some((e) => e.start === t.start) || (e.segments.skip.push({ start: t.start, end: t.end, name: t.name || "Пропустить" }), i++);
			}),
			i
		);
	}
	function c(e, t, i, n) {
		e &&
			Array.isArray(e) &&
			e.forEach((e, a) => {
				const o = e.season || e.s || t,
					s = e.episode || e.e || e.episode_number || a + 1;
				parseInt(s) === parseInt(i) && parseInt(o) === parseInt(t) && r(e, n);
			});
	}
	function p(e, t, i) {
		if (!e) return null;
		const n = String(t),
			a = String(i);
		return e[n] && e[n][a] ? e[n][a] : ("1" === n && "1" === a && e.movie) || e.movie ? e.movie : null;
	}
	function m(e) {
		let t = Lampa.Storage.get("lampac_unic_id", ""),
			i = Lampa.Storage.get("account_email", "");
		t || ((t = Lampa.Utils.uid(8).toLowerCase()), Lampa.Storage.set("lampac_unic_id", t));
		const n = (e, t) => e + (e.indexOf("?") >= 0 ? "&" : "?") + t;
		return (-1 === (e += "").indexOf("account_email=") && (e = n(e, "account_email=" + encodeURIComponent(i))), -1 === e.indexOf("uid=") && (e = n(e, "uid=" + encodeURIComponent(t))), -1 === e.indexOf("token=") && (e = n(e, "token=")), e);
	}
	async function d(e) {
		try {
			const t = await fetch(e);
			if (!t.ok) throw new Error(`HTTP error! status: ${t.status}`);
			return await t.text();
		} catch (e) {
			throw e;
		}
	}
	async function u(t) {
		let u = t.movie || t.card;
		if (!u) {
			const e = Lampa.Activity.active();
			e && (u = e.movie || e.card);
		}
		if (!u) return;
		const k = u.kinopoisk_id || ("kinopoisk" === u.source ? u.id : null) || u.kp_id,
			f = (function (e, t = 1) {
				if (e.episode || e.e || e.episode_number) return { season: parseInt(e.season || e.s || t), episode: parseInt(e.episode || e.e || e.episode_number) };
				if (e.playlist && Array.isArray(e.playlist)) {
					const i = e.url,
						n = e.playlist.findIndex((e) => e.url && e.url === i);
					if (-1 !== n) {
						const i = e.playlist[n];
						return { season: parseInt(i.season || i.s || t), episode: n + 1 };
					}
				}
				return { season: t, episode: 1 };
			})(t, 1);
		let g = f.episode,
			S = f.season;
		const U = u.number_of_seasons > 0 || (u.original_name && !u.original_title);
		if ((U || ((S = 1), (g = 1)), l(`Start search for: ${u.title} (S${S} E${g}) [Method: ${f.method || "calculated"}]`), console.log("[UltimateSkip DEBUG] Card Data:", u), console.log("[UltimateSkip DEBUG] Search Params:", { kpId: k, currentSeason: S, currentEpisode: g, isSerial: U }), k)) {
			const i = await (async function (t) {
				try {
					const i = `${e}${t}.json`,
						n = await fetch(i);
					return n.ok ? await n.json() : null;
				} catch (e) {
					return null;
				}
			})(k);
			if (i) {
				l(`[Success] Found in GitHub DB (KP: ${k})`);
				const e = p(i, S, g);
				return (
					e && (r(t, e), Lampa.Noty.show("Таймкоды загружены (GitHub)")),
					void (
						t.playlist &&
						Array.isArray(t.playlist) &&
						t.playlist.forEach((e) => {
							let t = e.season || e.s || S,
								n = e.episode || e.e || e.episode_number;
							if (t && n) {
								const a = p(i, t, n);
								a && r(e, a);
							}
						})
					)
				);
			}
		}
		l("GitHub failed, checking for Anime criteria...");
		const h = (u.original_language || "").toLowerCase(),
			y = "ja" === h || "zh" === h || "cn" === h,
			E = u.genres && u.genres.some((e) => 16 === e.id || (e.name && "animation" === e.name.toLowerCase()));
		if (y || E) {
			l("Anime criteria matched. Trying AniSkip...");
			const e = (_ = u.original_name || u.original_title || u.name)
					? _.replace(/\(\d{4}\)/g, "")
							.replace(/\(TV\)/gi, "")
							.replace(/Season \d+/gi, "")
							.replace(/Part \d+/gi, "")
							.replace(/[:\-]/g, " ")
							.replace(/\s+/g, " ")
							.trim()
					: "",
				i = (u.release_date || u.first_air_date || "0000").slice(0, 4),
				s = await (async function (e, t, i) {
					let n = e;
					t > 1 && (n += " Season " + t);
					const o = `${a}?q=${encodeURIComponent(n)}&limit=10`;
					console.log("[UltimateSkip DEBUG] Jikan Search URL:", o);
					try {
						const e = await fetch(o),
							t = await e.json();
						if ((console.log("[UltimateSkip DEBUG] Jikan Response:", t), !t.data || 0 === t.data.length)) return null;
						if (i) {
							const e = t.data.find((e) => {
								let t = e.year;
								return (!t && e.aired && e.aired.from && (t = e.aired.from.substring(0, 4)), String(t) === String(i));
							});
							if (e) return (console.log(`[UltimateSkip DEBUG] Jikan found matched year ${i}: ID ${e.mal_id} (${e.title})`), e.mal_id);
						}
						return (console.log(`[UltimateSkip DEBUG] Jikan year match failed. Using first result: ID ${t.data[0].mal_id}`), t.data[0].mal_id);
					} catch (e) {
						return (l("Jikan Error: " + e.message), console.log("[UltimateSkip DEBUG] Jikan Exception:", e), null);
					}
				})(e, S, i);
			if (s) {
				const e = await (async function (e, t) {
						const i = o.map((e) => "types=" + e);
						i.push("episodeLength=0");
						const a = `${n}/${e}/${t}?${i.join("&")}`;
						console.log("[UltimateSkip DEBUG] AniSkip URL:", a);
						try {
							const e = await fetch(a);
							if (404 === e.status) return (console.log("[UltimateSkip DEBUG] AniSkip 404 Not Found"), []);
							const t = await e.json();
							return (console.log("[UltimateSkip DEBUG] AniSkip Response:", t), (t.found && t.results) || []);
						} catch (e) {
							return (console.log("[UltimateSkip DEBUG] AniSkip Error:", e), []);
						}
					})(s, g),
					i = (function (e) {
						if (!e || !e.length) return [];
						const t = [];
						return (
							e.forEach((e) => {
								if (!e.interval) return;
								const i = (e.skipType || e.skip_type || "").toLowerCase();
								let n = "Пропустить";
								i.includes("op") ? (n = "Опенинг") : i.includes("ed") ? (n = "Эндинг") : "recap" === i && (n = "Рекап");
								const a = void 0 !== e.interval.startTime ? e.interval.startTime : e.interval.start_time,
									o = void 0 !== e.interval.endTime ? e.interval.endTime : e.interval.end_time;
								void 0 !== a && void 0 !== o && t.push({ start: a, end: o, name: n });
							}),
							t
						);
					})(e);
				if (i.length > 0) return (l("[Success] Found in AniSkip"), r(t, i), c(t.playlist, S, g, i), Lampa.Noty.show("Таймкоды загружены (AniSkip)"), void (window.Lampa.Player.listener && window.Lampa.Player.listener.send("segments", { skip: t.segments.skip })));
				l("AniSkip returned no segments.");
			} else l("Jikan ID not found.");
		} else l("Not an Anime (Language/Genre mismatch). Skipping AniSkip.");
		var _;
		l("AniSkip failed, trying Skaz...");
		const b = await (async function (e, t, n) {
			console.log("[UltimateSkip DEBUG] Starting Skaz Search...");
			const a = e.title || e.name,
				o = e.original_title || e.original_name,
				l = (e.release_date || e.first_air_date || "0000").slice(0, 4),
				r = { id: e.id, imdb_id: e.imdb_id || "", kinopoisk_id: e.kinopoisk_id || "", title: a, original_title: o, year: l, serial: e.number_of_seasons || t > 0 ? 1 : 0, source: "tmdb", life: !0 };
			console.log("[UltimateSkip DEBUG] Skaz Params:", r);
			const c = Object.keys(r)
				.map((e) => `${e}=${encodeURIComponent(r[e])}`)
				.join("&");
			try {
				let e = m(`${i}lite/events?${c}`);
				console.log("[UltimateSkip DEBUG] Skaz Init URL:", e);
				let a = await d(e),
					o = JSON.parse(a);
				console.log("[UltimateSkip DEBUG] Skaz Init Response:", o);
				let l = null;
				if (o.life && o.memkey) {
					console.log("[UltimateSkip DEBUG] Skaz Life Mode detected");
					const e = 7500,
						t = 250,
						n = Math.ceil(e / t);
					for (let e = 1; e <= n; e++) {
						await s(t);
						const e = m(`${i}lifeevents?memkey=${o.memkey}&${c}`);
						try {
							let t = await d(e),
								i = JSON.parse(t);
							const n = (Array.isArray(i) ? i : i.online || []).find((e) => e.name && e.name.toLowerCase().includes("alloha"));
							if (n) {
								((l = n), console.log("[UltimateSkip DEBUG] Alloha found in Life mode"));
								break;
							}
						} catch (e) {}
					}
				} else l = (Array.isArray(o) ? o : o.online || []).find((e) => e.name && e.name.toLowerCase().includes("alloha"));
				if (!l) return (console.log("[UltimateSkip DEBUG] Alloha source NOT found in Skaz response."), null);
				console.log("[UltimateSkip DEBUG] Alloha Data Found:", l);
				let r = m(`${l.url}${l.url.includes("?") ? "&" : "?"}${c}`),
					p = 0;
				for (; p < 5; ) {
					(p++, console.log(`[UltimateSkip DEBUG] Step ${p}, URL: ${r}`));
					const e = await d(r);
					let i = !1,
						a = null;
					if (e.trim().startsWith("{") || e.trim().startsWith("["))
						try {
							((a = JSON.parse(e)), (i = !0), console.log("[UltimateSkip DEBUG] Response is JSON:", a));
						} catch (e) {}
					if (i) {
						if (a.segments) return (console.log("[UltimateSkip DEBUG] JSON contains segments!", a.segments), a.segments);
						if (a.url && !a.playlist) {
							(console.log("[UltimateSkip DEBUG] JSON redirect to:", a.url), (r = m(a.url)));
							continue;
						}
					}
					const o = new DOMParser().parseFromString(e, "text/html").querySelectorAll(".videos__item");
					if ((console.log(`[UltimateSkip DEBUG] Found ${o.length} items in HTML.`), 0 === o.length && !i)) {
						console.log("[UltimateSkip DEBUG] No items and not JSON. Break.");
						break;
					}
					let s = null;
					const l = (e) => (e || "").toLowerCase().trim(),
						c = (e) => {
							const t = l(e).match(/(\d+)/);
							return t ? parseInt(t[1], 10) : null;
						};
					for (let e = 0; e < o.length; e++) {
						const i = o[e],
							a = i.getAttribute("s"),
							r = i.getAttribute("e"),
							p = l(i.textContent);
						if ((console.log(`[UltimateSkip DEBUG] Item ${e}: text="${p}", s="${a}", e="${r}"`), a && r)) {
							if (a == t && r == n) {
								(console.log("[UltimateSkip DEBUG] Match found by attributes s/e!"), (s = i));
								break;
							}
						} else if (a) {
							if (a == t) {
								(console.log("[UltimateSkip DEBUG] Match found by attribute s (season only)!"), (s = i));
								break;
							}
						} else {
							if (p.includes("сезон") && c(p) == t) {
								(console.log("[UltimateSkip DEBUG] Match found by text 'сезон'!"), (s = i));
								break;
							}
							if (p.includes("серия") && c(p) == n) {
								(console.log("[UltimateSkip DEBUG] Match found by text 'серия'!"), (s = i));
								break;
							}
						}
					}
					if (!s) {
						console.log("[UltimateSkip DEBUG] No exact match found. Checking first item fallback.");
						const e = l(o[0].textContent);
						if (e.includes("сезон") || e.includes("серия") || o[0].hasAttribute("s") || o[0].hasAttribute("e")) {
							console.log("[UltimateSkip DEBUG] First item looks like a specific season/episode but didn't match. Aborting fallback.");
							break;
						}
						(console.log("[UltimateSkip DEBUG] Using first item as fallback."), (s = o[0]));
					}
					const u = s.getAttribute("data-json");
					if (!u) {
						console.log("[UltimateSkip DEBUG] No data-json attribute on target item.");
						break;
					}
					try {
						const e = JSON.parse(u);
						if (!e || !e.url) {
							console.log("[UltimateSkip DEBUG] data-json found but no URL.");
							break;
						}
						(console.log("[UltimateSkip DEBUG] Found data-json URL:", e.url), (r = m(e.url)));
					} catch (e) {
						console.log("[UltimateSkip DEBUG] Error parsing data-json:", e);
						break;
					}
				}
			} catch (e) {
				console.log("[UltimateSkip DEBUG] Skaz Error:", e);
			}
			return null;
		})(u, S, g);
		if (b) {
			const e = (w = b) && w.skip && Array.isArray(w.skip) ? w.skip.filter((e) => null != e.start && null != e.end).map((e) => ({ start: e.start, end: e.end, name: "Пропустить" })) : [];
			if (e.length > 0) return (l("[Success] Found in Skaz"), r(t, e), c(t.playlist, S, g, e), void Lampa.Noty.show("Таймкоды загружены (Skaz)"));
		}
		var w;
	}
	function k() {
		if (window.lampa_ultimate_skip) return;
		window.lampa_ultimate_skip = !0;
		const e = Lampa.Player.play;
		((Lampa.Player.play = function (t) {
			const i = this;
			(Lampa.Loading.start(() => {
				(Lampa.Loading.stop(), e.call(i, t));
			}),
				u(t)
					.then(() => {
						(Lampa.Loading.stop(), e.call(i, t));
					})
					.catch((n) => {
						(console.error("[UltimateSkip] Critical Error:", n), Lampa.Loading.stop(), e.call(i, t));
					}));
		}),
			console.log("[UltimateSkip] Combined Plugin Loaded (DB -> AniSkip -> Skaz)"));
	}
	window.Lampa && window.Lampa.Player ? k() : window.document.addEventListener("app_ready", k);
})();
