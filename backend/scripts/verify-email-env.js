#!/usr/bin/env node
// Verify email-related environment configuration for staging/production
// - Reads process.env and optionally backend/.env for local checks
// - Flags missing/placeholder values, weak domains, and common misconfigs

const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;

// Load backend/.env if present to aid local checks (doesn't override real env)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: false });
}

const REQUIRED = ['EMAIL_HOST','EMAIL_PORT','EMAIL_USER','EMAIL_PASSWORD','FROM_NAME','FROM_EMAIL','FRONTEND_URL'];
const PROD_LIKE = /^(production|staging)$/i.test(process.env.NODE_ENV || '');

function isPlaceholder(val) {
  if (val === undefined || val === null) return true;
  const s = String(val).trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  const weak = ['admin','password','changeme','test','example'];
  if (weak.includes(lower)) return true;
  if (lower.includes('your-email') || lower.includes('your-16-char') || lower.includes('example.com')) return true;
  return false;
}

function isNumericPort(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 && n < 65536;
}

function parseDomain(emailOrUrl) {
  if (!emailOrUrl) return null;
  const s = String(emailOrUrl).trim();
  if (s.includes('@')) {
    return s.split('@')[1]?.toLowerCase() || null;
  }
  try {
    const u = new URL(s);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isFreeEmailDomain(domain) {
  if (!domain) return false;
  const free = ['gmail.com','yahoo.com','outlook.com','hotmail.com','live.com','aol.com','proton.me','icloud.com','yandex.com'];
  return free.includes(domain);
}

async function checkSpf(domain) {
  try {
    const txt = await dns.resolveTxt(domain);
    const flat = txt.map(parts => parts.join('')).join(' ');
    const hasSpf = /v=spf1\s/i.test(flat);
    return { ok: !!hasSpf, detail: hasSpf ? 'SPF record present' : 'No SPF record found' };
  } catch (e) {
    return { ok: false, detail: `DNS TXT lookup failed: ${e.code || e.message}` };
  }
}

async function checkDmarc(domain) {
  const name = `_dmarc.${domain}`;
  try {
    const txt = await dns.resolveTxt(name);
    const flat = txt.map(parts => parts.join('')).join(' ');
    const has = /v=DMARC1;/i.test(flat);
    return { ok: !!has, detail: has ? 'DMARC record present' : 'No DMARC record found' };
  } catch (e) {
    return { ok: false, detail: `DNS TXT lookup failed: ${e.code || e.message}` };
  }
}

async function main() {
  console.log('Email env verification');

  const results = REQUIRED.map(k => {
    const v = process.env[k];
    const missing = v === undefined || String(v).trim() === '';
    const placeholder = isPlaceholder(v);
    return { key: k, present: !missing, placeholder, value: v };
  });

  const issues = [];

  // Report presence/placeholder
  results.forEach(r => {
    const status = !r.present ? 'MISSING' : (r.placeholder ? 'PLACEHOLDER' : 'OK');
    console.log(`- ${r.key}: ${status}`);
    if (!r.present || r.placeholder) issues.push({ key: r.key, type: !r.present ? 'missing' : 'placeholder' });
  });

  // Semantic validations
  const port = process.env.EMAIL_PORT;
  if (port && !isNumericPort(port)) {
    issues.push({ key: 'EMAIL_PORT', type: 'invalid', msg: `EMAIL_PORT must be a valid number, got "${port}"` });
  }

  const fromEmail = process.env.FROM_EMAIL;
  const fromDomain = parseDomain(fromEmail);
  if (fromDomain && isFreeEmailDomain(fromDomain)) {
    issues.push({ key: 'FROM_EMAIL', type: 'domain', msg: `FROM_EMAIL uses a free mailbox domain (${fromDomain}). Use a verified domain you control.` });
  }

  const feUrl = process.env.FRONTEND_URL;
  if (PROD_LIKE && feUrl) {
    try {
      const u = new URL(feUrl);
      if (u.protocol !== 'https:') {
        issues.push({ key: 'FRONTEND_URL', type: 'insecure', msg: 'FRONTEND_URL should use HTTPS in production/staging.' });
      }
      if (['localhost','127.0.0.1'].includes(u.hostname)) {
        issues.push({ key: 'FRONTEND_URL', type: 'local', msg: 'FRONTEND_URL should not point to localhost in production/staging.' });
      }
    } catch {
      issues.push({ key: 'FRONTEND_URL', type: 'invalid', msg: 'FRONTEND_URL is not a valid URL.' });
    }
  }

  // Optional DNS checks (best-effort) for the sender domain
  let spf, dmarc;
  if (fromDomain) {
    spf = await checkSpf(fromDomain);
    dmarc = await checkDmarc(fromDomain);
    if (!spf.ok) issues.push({ key: 'SPF', type: 'dns', msg: `SPF check: ${spf.detail}` });
    if (!dmarc.ok) issues.push({ key: 'DMARC', type: 'dns', msg: `DMARC check: ${dmarc.detail}` });
  }

  if (issues.length) {
    console.log(`\nFAIL: ${issues.length} issue(s) detected.`);
    for (const i of issues) {
      if (i.msg) console.log(`- ${i.key}: ${i.msg}`);
    }
    console.log(`\nAction items:`);
    console.log(`1) Set real values in your staging/production secret stores for: ${REQUIRED.join(', ')}`);
    console.log(`2) Ensure FROM_EMAIL is a verified address on your domain (not a free provider).`);
    console.log(`3) Publish SPF (v=spf1 ...) and DMARC (v=DMARC1; ...) TXT records for your domain.`);
    console.log(`4) Use HTTPS and non-localhost for FRONTEND_URL in production/staging.`);
    process.exitCode = 1;
  } else {
    console.log('\nPASS: Email env looks good.');
    if (fromDomain) {
      console.log(`- SPF: ${spf?.detail || 'skipped'}`);
      console.log(`- DMARC: ${dmarc?.detail || 'skipped'}`);
    }
  }
}

main().catch(err => {
  console.error('Verifier error:', err.message || err);
  process.exitCode = 1;
});
