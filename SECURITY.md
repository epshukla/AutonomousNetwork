# Security Policy

## Supported Versions

The following versions of **AutonomousNetwork** currently receive security updates.

| Version | Supported |
|--------|-----------|
| dev1   | ✅ Yes |
| dev    | ⚠ Development only |
| older versions | ❌ No |

Please ensure you are using the latest version of the project when reporting issues.

---

## Reporting a Vulnerability

If you discover a security vulnerability in **AutonomousNetwork**, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report it through one of the following methods:

Email: eshanshukla.contact@gmail.com

When reporting a vulnerability, please include:

- A detailed description of the issue
- Steps to reproduce the vulnerability
- Potential impact
- Suggested fix (if available)

We will acknowledge receipt of the report within **72 hours**.

---

## Responsible Disclosure

We follow a responsible disclosure process:

1. Security report is received and acknowledged
2. The issue is investigated and verified
3. A patch or mitigation is developed
4. The vulnerability is fixed
5. A security update is released

We ask reporters to **avoid publicly disclosing the vulnerability until it has been fixed.**

---

## Security Best Practices for Contributors

When contributing code, please follow these security practices:

- Avoid committing secrets (API keys, tokens, credentials)
- Use environment variables for sensitive data
- Validate all external inputs
- Follow secure coding practices
- Keep dependencies up to date

---

## Dependency Security

Dependencies should be monitored for vulnerabilities using tools such as:

- `npm audit`
- `Dependabot`
- `Snyk`

Contributors should regularly check for vulnerable packages.

---

## Security Updates

Security fixes will be released through updates to the **main branch**.

Users are encouraged to pull the latest version regularly.

---

Thank you for helping keep **AutonomousNetwork** secure.
