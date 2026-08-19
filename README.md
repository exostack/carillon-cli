# @exostack/carillon-cli

The Carillon command line. Organizations, apps, push credentials and API keys,
from a terminal.

It speaks to two hosts, on purpose: signing in and organization membership go
through the dashboard host (`app.carillon.dev`, Better Auth), while apps,
credentials and keys are managed through the public API's management section
(`api.carillon.dev`, `/v1`) — the same session, presented as a bearer token.

## Installing

```sh
npm install -g @exostack/carillon-cli
```

Node 20 or later.

## Signing in

```sh
carillon login
carillon use        # pick the organization and app the other commands work in
carillon whoami
```

There is no self-registration, on purpose: Carillon accounts come from a
dashboard invitation, or are the first owner of a fresh installation. When
`carillon login` refuses you, ask an organization owner to invite you from the
dashboard — the invitation email creates your account and sets your password.

The token lands in `~/.config/carillon/credentials.json`, readable by you
alone. `carillon logout` revokes the session and deletes it.

## Commands

```
carillon login                        sign in with email and password
carillon logout                       sign out and forget the stored token
carillon whoami                       who is signed in, and the current context

carillon use                          pick organization and app, interactively

carillon org list
carillon org create <name>
carillon org invite <email> [--role admin|member]

carillon app list
carillon app create <name>

carillon credential list
carillon credential upload            APNs .p8 or FCM service account JSON, guided

carillon key list
carillon key create [--type secret|mobile] [--mode live|test] [--name <label>]
carillon key revoke <id>
```

Every command prompts for what it was not given, and takes flags for scripts.
List commands accept `--json` and print nothing else, so their output pipes
into `jq` as it is.

Sending is deliberately not a CLI command. Notifications are sent with a
**secret key** against the public API — `carillon key create --type secret`,
then `POST /v1/messages` from your backend or an SDK. The CLI manages; the
keys send.

Two things behave exactly as they do in the dashboard, because the rules are
the product's, not the tool's. A **secret key** is printed once, at creation,
and never again — copy it then. A **credential's material** (the `.p8`, the
service account JSON) is read from the file you name, sealed on arrival, and
never returned or echoed; what you see back is its fingerprint.

## Pointing it elsewhere

Two endpoints, two overrides:

- `CARILLON_API_URL` — the public API, `https://api.carillon.dev` by default.
- `CARILLON_AUTH_URL` — the dashboard host sign-in goes through,
  `https://app.carillon.dev` by default.

A local stack is `CARILLON_API_URL=http://localhost:28080
CARILLON_AUTH_URL=http://localhost:28081`.

Configuration lives in `~/.config/carillon/` (`$XDG_CONFIG_HOME` respected).
A config file written by an older version, holding a single `api_url`, is
read as the auth host — that is what it pointed at.

No telemetry, no update checks. The only network calls are the ones you asked
for.

## Development

```sh
npm install
npm run generate    # regenerates src/generated/api.ts from ../carillon
npm run build
npm test
```

The API client is generated from the public OpenAPI specification
(`../carillon/public-openapi.json`), never written by hand. The generated
types are committed, so the repository builds without the spec next to it;
`npm run generate` refreshes them when it is.

## License

MIT © Exostack SARL
