// Relais ADE : récupère l'export iCal côté serveur (le navigateur ne peut pas lire ADE directement à cause de CORS)
// URLs configurables dans Vercel : ADE_SPE_URL et ADE_TC_URL (Settings → Environment Variables).
const DEFAULTS = {
  spe: "https://planning.polytech.universite-paris-saclay.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=1305&projectId=2&calType=ical",
  tc: "https://planning.polytech.universite-paris-saclay.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=1380&projectId=2&calType=ical"
};

function withDates(raw) {
  const u = new URL(raw);
  const d = new Date();
  const first = new Date(d.getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const last = new Date(d.getTime() + 365 * 864e5).toISOString().slice(0, 10);
  u.searchParams.set("firstDate", first);
  u.searchParams.set("lastDate", last);
  u.searchParams.set("calType", "ical");
  return u.toString();
}

export default async function handler(req, res) {
  const src = String((req.query && req.query.src) || "spe");
  const base = src === "tc" ? (process.env.ADE_TC_URL || DEFAULTS.tc) : (process.env.ADE_SPE_URL || DEFAULTS.spe);
  if (!base || !/^https:\/\/planning\.polytech\.universite-paris-saclay\.fr\//.test(base)) {
    res.status(404).send("Calendrier non configuré");
    return;
  }
  try {
    const r = await fetch(withDates(base), { headers: { "User-Agent": "PHOT3A-app" } });
    const txt = await r.text();
    if (!r.ok || txt.indexOf("BEGIN:VCALENDAR") < 0) {
      res.status(502).send("ADE indisponible");
      return;
    }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=10800, stale-while-revalidate=86400");
    res.status(200).send(txt);
  } catch (e) {
    res.status(502).send("ADE injoignable");
  }
}
