import nodemailer from "nodemailer";

let cachedTransporter = null;
let cachedKey = "";

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !Number.isInteger(port) || port <= 0 || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error("Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }
  const key = [SMTP_HOST, port, SMTP_USER, SMTP_PASS].join("|");
  if (!cachedTransporter || cachedKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    cachedKey = key;
  }
  return { transporter: cachedTransporter, from: SMTP_FROM };
}

export async function sendEmail({ to, subject, text, html, attachments }) {
  const { transporter, from } = getTransporter();
  await transporter.sendMail({ from, to, subject, text, ...(html ? { html } : {}), ...(attachments ? { attachments } : {}) });
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

/** Public base URL used in links inside emails. */
export function getAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
    || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Shared branded wrapper for HTML emails. `rows` is an array of [label, value]. */
export function renderEmail({ heading, intro, rows = [], cta, footer }) {
  const rowHtml = rows.map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px;color:#58718B;font-size:13px;white-space:nowrap;vertical-align:top;border-bottom:1px solid #E5ECF3">${escapeHtml(label)}</td>
        <td style="padding:8px 12px;color:#10243A;font-size:14px;border-bottom:1px solid #E5ECF3">${escapeHtml(value).replace(/\n/g, "<br>")}</td>
      </tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#F3F6FA;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#081526;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0;font-size:20px;font-weight:bold">TrustBid</div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px">
      <h2 style="margin:0 0 12px;color:#10243A;font-size:20px">${escapeHtml(heading)}</h2>
      ${intro ? `<p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(intro).replace(/\n/g, "<br>")}</p>` : ""}
      ${rowHtml ? `<table style="width:100%;border-collapse:collapse;margin-bottom:20px">${rowHtml}</table>` : ""}
      ${cta ? `<p style="margin:20px 0"><a href="${escapeHtml(cta.url)}" style="background:#1D4ED8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block">${escapeHtml(cta.label)}</a></p>` : ""}
      ${footer ? `<p style="color:#58718B;font-size:12px;line-height:1.5;margin:16px 0 0">${escapeHtml(footer).replace(/\n/g, "<br>")}</p>` : ""}
    </div>
  </div></body></html>`;
  const text = [
    heading, "", intro || "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    cta ? `\n${cta.label}: ${cta.url}` : "",
    footer ? `\n${footer}` : "",
    "\nTrustBid",
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
  return { html, text };
}

export const formatMwk = (value) => `MWK ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const formatDateTime = (value) => new Date(value).toLocaleString("en-GB", {
  dateStyle: "full", timeStyle: "short", timeZone: "Africa/Blantyre",
}) + " (CAT)";
