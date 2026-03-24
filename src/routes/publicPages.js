const express = require('express');

const router = express.Router();

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --bg: #f4f1e8;
      --paper: #fffaf0;
      --ink: #1f2937;
      --muted: #5b6472;
      --line: #ded6c5;
      --accent: #b45309;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top left, #efe6d0 0, transparent 28%),
        linear-gradient(180deg, var(--bg), #ece7db);
      color: var(--ink);
      min-height: 100vh;
      padding: 32px 16px;
    }
    .wrap {
      max-width: 840px;
      margin: 0 auto;
    }
    .card {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 18px 60px rgba(31, 41, 55, 0.08);
    }
    .eyebrow {
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-bottom: 12px;
      font-family: Arial, sans-serif;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 40px;
      line-height: 1.05;
    }
    p, li {
      font-size: 18px;
      line-height: 1.65;
      color: var(--muted);
    }
    h2 {
      margin-top: 28px;
      font-size: 22px;
      color: var(--ink);
    }
    ul {
      padding-left: 22px;
    }
    a {
      color: var(--accent);
    }
    .meta {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid var(--line);
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

router.get('/privacy-policy', (req, res) => {
  res.send(page('Privacy Policy', `
    <div class="eyebrow">AutoMonk</div>
    <h1>Privacy Policy</h1>
    <p>AutoMonk helps operators connect social accounts, generate content, and schedule publishing workflows. This page explains what information we collect and how it is used.</p>
    <h2>Information We Collect</h2>
    <ul>
      <li>Account connection data such as platform account IDs and access tokens provided through supported OAuth flows.</li>
      <li>Content inputs, generated drafts, scheduling data, and publishing metadata needed to run the service.</li>
      <li>Basic technical logs used to monitor reliability, security, and abuse prevention.</li>
    </ul>
    <h2>How We Use Information</h2>
    <ul>
      <li>To connect and manage authorized social media accounts.</li>
      <li>To generate, schedule, publish, and analyze social content requested by the operator.</li>
      <li>To maintain service security, diagnose failures, and improve product reliability.</li>
    </ul>
    <h2>Sharing</h2>
    <p>We do not sell personal information. Data is shared only with infrastructure or platform providers required to operate the service, such as Meta, storage providers, or database/hosting services.</p>
    <h2>Retention</h2>
    <p>Connected account data and related content records are retained only as long as needed to operate the service or meet legitimate operational and legal requirements.</p>
    <h2>Contact</h2>
    <p>For privacy questions, contact <a href="mailto:business.monkmedia.io@gmail.com">business.monkmedia.io@gmail.com</a>.</p>
    <div class="meta">Last updated: March 23, 2026</div>
  `));
});

router.get('/terms-of-service', (req, res) => {
  res.send(page('Terms of Service', `
    <div class="eyebrow">AutoMonk</div>
    <h1>Terms of Service</h1>
    <p>By using AutoMonk, you agree to use the service only for lawful content operations and only with social accounts you are authorized to control.</p>
    <h2>Use of Service</h2>
    <ul>
      <li>You are responsible for the accounts, content, and permissions you connect to the service.</li>
      <li>You must comply with the terms, policies, and rate limits of connected platforms such as Meta, Instagram, Facebook, LinkedIn, X, Threads, and YouTube.</li>
      <li>You may not use the service for spam, abuse, fraud, impersonation, or unlawful publishing activity.</li>
    </ul>
    <h2>Availability</h2>
    <p>The service is provided on an as-available basis. Features may change, and uptime is not guaranteed.</p>
    <h2>Responsibility</h2>
    <p>You remain responsible for reviewing generated content, connected credentials, publishing schedules, and compliance with platform rules.</p>
    <h2>Contact</h2>
    <p>For support or legal questions, contact <a href="mailto:business.monkmedia.io@gmail.com">business.monkmedia.io@gmail.com</a>.</p>
    <div class="meta">Last updated: March 23, 2026</div>
  `));
});

router.get('/data-deletion', (req, res) => {
  res.send(page('Data Deletion Instructions', `
    <div class="eyebrow">AutoMonk</div>
    <h1>Data Deletion Instructions</h1>
    <p>If you want your AutoMonk-related data removed, send a deletion request to <a href="mailto:business.monkmedia.io@gmail.com">business.monkmedia.io@gmail.com</a> from the email associated with your account or include enough details to identify the connected workspace.</p>
    <h2>Please Include</h2>
    <ul>
      <li>Your name or organization name.</li>
      <li>The connected platform account name or ID.</li>
      <li>A clear statement that you want account data deleted.</li>
    </ul>
    <h2>What We Delete</h2>
    <ul>
      <li>Stored connected platform credentials and linked account records.</li>
      <li>Associated scheduling and content records when applicable and operationally safe to remove.</li>
    </ul>
    <h2>Timeline</h2>
    <p>Verified deletion requests are typically processed within 30 days unless longer retention is required for security, fraud prevention, or legal compliance.</p>
    <div class="meta">Last updated: March 23, 2026</div>
  `));
});

module.exports = router;
