/**
 * Minimal JWT HS256 — Node crypto only
 */
'use strict';

const crypto = require('crypto');

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function fromB64url(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64').toString('utf8');
}

function sign(payload, secret, opts) {
  opts = opts || {};
  const hours = opts.hours != null ? opts.hours : 12;
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, {
    iat: now,
    exp: now + Math.floor(hours * 3600),
    jti: payload.jti || crypto.randomBytes(8).toString('hex')
  });
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlJson(header);
  const p = b64urlJson(body);
  const data = h + '.' + p;
  const sig = crypto
    .createHmac('sha256', String(secret))
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return data + '.' + sig;
}

function verify(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  const expected = crypto
    .createHmac('sha256', String(secret))
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch (e) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(parts[1]));
  } catch (e) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp != null && Number(payload.exp) < now) return null;
  if (payload.nbf != null && Number(payload.nbf) > now) return null;
  return payload;
}

module.exports = { sign, verify, b64url };
