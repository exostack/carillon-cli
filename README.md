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

Node 22.12 or later.

## Signing in

```sh
carillon login
carillon use        # pick the organization and app the other commands work in
carillon whoami
```

`carillon login` signs in through the browser: it prints a short code and a
dashboard URL, opens the browser on it when it can, and waits while you
approve the sign-in there. No password ever crosses the terminal — and the
browser can be on a different machine, as long as it can reach the dashboard.

For scripts and CI there is the password flow, chosen by giving either flag:

```sh
carillon login --email you@company.com --password "$CARILLON_PASSWORD"
```

There is no self-registration, on purpose: Carillon accounts come from a
dashboard invitation, or are the first owner of a fresh installation. When
`carillon login` refuses you, ask an organization owner to invite you from the
dashboard — the invitation email creates your account and sets your password.

The token lands in `~/.config/carillon/credentials.json`, readable by you
alone. `carillon logout` revokes the session and deletes it.

## Commands

```
carillon login                        sign in through the browser (--email/--password for scripts)
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

carillon audience list                audiences is accepted as an alias
carillon audience create              pick the filters one at a time, counting as you go
carillon audience preview [--json '<definition>']
carillon audience delete <name-or-id> [--yes]
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

## Audiences

An audience is a set of filters saved under a name, so a campaign can say who
it is for in one word. The filters narrow together — a device belongs when it
matches every one of them — and an audience with no filters is the whole
reachable park of the app.

`carillon audience create` asks for a name, then builds the definition one
filter at a time, counting the devices it reaches after every change. That
count is the point of the loop: a filter can only ever shrink an audience, so
watching the number is how you know the filter did what you meant.

The ten fields a filter is about: `platform`, `push_permission`, `source`,
`locale`, `timezone_id`, `app_version`, `app_build`, `os_version`,
`last_active` (seen within so many days) and `tag` (a key and a value). A
`last_active` filter is answered when the audience resolves, not when it was
saved — a campaign sent next month asks the question again.

`carillon audience preview` answers the same question without saving
anything, and takes a definition whole for scripts:

```sh
carillon audience preview --json '{"filters":[{"field":"platform","value":"ios"},{"field":"last_active","within_days":30}]}'
```

Sending to a saved audience is the API's business, not the CLI's: pass its id
as `"audience": { "audience_id": "<id>" }` to `POST /v1/messages`. The filters
are copied onto the campaign as it is written, so deleting an audience never
changes who a campaign already accepted goes to.

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
