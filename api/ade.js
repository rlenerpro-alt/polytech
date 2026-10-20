// Relais ADE : récupère l'export iCal côté serveur (le navigateur ne peut pas lire ADE directement à cause de CORS).
// Le serveur ADE n'envoie pas son certificat intermédiaire : on va le chercher à l'adresse indiquée dans son
// propre certificat (champ « CA Issuers »), puis on fait la vraie requête avec une vérification TLS complète.
// URLs configurables dans Vercel : ADE_SPE_URL et ADE_TC_URL (Settings → Environment Variables).
import tls from "node:tls";
import https from "node:https";
import http from "node:http";
import { X509Certificate } from "node:crypto";

const DEFAULTS = {
  spe: "https://planning.polytech.universite-paris-saclay.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=1305&projectId=2&calType=ical",
  tc: "https://planning.polytech.universite-paris-saclay.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=1380&projectId=2&calType=ical"
};
const HOST = "planning.polytech.universite-paris-saclay.fr";
let extraCA = null; // certificats intermédiaires récupérés, gardés entre deux appels

function withDates(raw) {
  const u = new URL(raw);
  const d = new Date();
  u.searchParams.set("firstDate", new Date(d.getTime() - 30 * 864e5).toISOString().slice(0, 10));
  u.searchParams.set("lastDate", new Date(d.getTime() + 365 * 864e5).toISOString().slice(0, 10));
  u.searchParams.set("calType", "ical");
  return u.toString();
}

function toPem(buf) {
  const s = buf.toString("latin1");
  if (s.startsWith("-----BEGIN")) return s;
  const b64 = buf.toString("base64").match(/.{1,64}/g).join("\n");
  return "-----BEGIN CERTIFICATE-----\n" + b64 + "\n-----END CERTIFICATE-----\n";
}

function issuerUrl(x509) {
  const m = String(x509.infoAccess || "").match(/CA Issuers - URI:(\S+)/);
  return m ? m[1] : null;
}

function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, { timeout: 8000 }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); download(new URL(r.headers.location, url).toString()).then(resolve, reject); return; }
      const chunks = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("timeout", () => req.destroy(new Error("timeout certificat")));
    req.on("error", reject);
  });
}

function leafCert() {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host: HOST, port: 443, servername: HOST, rejectUnauthorized: false, timeout: 8000 }, () => {
      const c = s.getPeerCertificate(false); s.end();
      if (!c || !c.raw) reject(new Error("certificat illisible")); else resolve(new X509Certificate(c.raw));
    });
    s.on("timeout", () => s.destroy(new Error("timeout TLS")));
    s.on("error", reject);
  });
}

async function chainCA() {
  if (extraCA) return extraCA;
  const pems = [];
  let cert = await leafCert();
  for (let i = 0; i < 3; i++) { // jusqu'à 3 niveaux d'intermédiaires
    const url = issuerUrl(cert); if (!url) break;
    const pem = toPem(await download(url)); pems.push(pem);
    cert = new X509Certificate(pem);
    if (cert.issuer === cert.subject) break; // racine atteinte
  }
  extraCA = pems;
  return pems;
}

function getText(url, ca) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca: ca ? [...tls.rootCertificates, ...ca] : undefined, timeout: 15000, headers: { "User-Agent": "Mozilla/5.0 (PHOT3A-app)", Accept: "text/calendar,*/*" } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); getText(new URL(r.headers.location, url).toString(), ca).then(resolve, reject); return; }
      const chunks = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => resolve({ status: r.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout ADE")));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const q = req.query || {};
  const TPL = "https://" + HOST + "/jsp/custom/modules/plannings/anonymous_cal.jsp?projectId=2&calType=ical&resources=";
  let base;
  if (q.res !== undefined) {
    if (!/^\d{1,6}$/.test(String(q.res))) { res.status(400).send("Ressource ADE invalide"); return; }
    base = TPL + q.res;
  } else {
    base = String(q.src || "spe") === "tc" ? (process.env.ADE_TC_URL || DEFAULTS.tc) : (process.env.ADE_SPE_URL || DEFAULTS.spe);
  }
  if (!base || !base.startsWith("https://" + HOST + "/")) { res.status(404).send("Calendrier non configuré"); return; }
  const url = withDates(base);
  try {
    let r;
    try { r = await getText(url, null); }
    catch (e) {
      const code = (e && (e.code || e.message)) || "";
      if (!/UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT|CERT_UNTRUSTED|SELF_SIGNED/.test(code)) throw e;
      r = await getText(url, await chainCA()); // vérification TLS complète, avec l'intermédiaire manquant
    }
    if (r.status !== 200 || r.text.indexOf("BEGIN:VCALENDAR") < 0) { res.status(502).send("ADE a répondu HTTP " + r.status + " : " + r.text.slice(0, 160).replace(/\s+/g, " ")); return; }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=10800, stale-while-revalidate=86400");
    res.status(200).send(r.text);
  } catch (e) {
    extraCA = null;
    res.status(502).send("ADE injoignable — " + ((e && (e.code || e.message)) || "erreur"));
  }
}
