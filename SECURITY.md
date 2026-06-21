# Security Policy

## Supported scope

This repository is a static-export proof of concept. It does not include server-side authentication, API routes, medical record integration, or a production authorization boundary.

Browser-side controls in this project are intended to add friction, traceability, and deterrence. They do not prevent data leakage, screenshots, copying, scraping, or unauthorized access once content is delivered to a browser.

This file covers vulnerability reporting only. For the security boundary itself — assets, adversary classes, per-control "does / does not do" mapping, residual risk, and non-goals — see `THREAT_MODEL.md`.

## Reporting a vulnerability

Please do not open a public issue for security vulnerabilities.

Use GitHub private vulnerability reporting if it is enabled for this repository. If it is not enabled, contact the repository maintainer privately through the contact information on their GitHub profile before sharing details publicly.

Include:

- Affected files or routes.
- Steps to reproduce.
- Expected and actual behavior.
- Impact and any suggested mitigation.

## Sensitive data

Do not commit real secrets, credentials, private keys, production exports, or private `.env` files. If a secret was committed at any point, rotate it even if the file is later removed.
