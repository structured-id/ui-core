# @structured-id/ui-core

Shared UI package for StructuredID applications: Vue 3 composables, Pinia stores and reusable components over the generated clients of [`@structured-id/proto`](https://www.npmjs.com/package/@structured-id/proto).

## What's Inside

- **Composables** -- `createAuth` (password ceremonies over an injected ZKPP client), `useAuthApi`, `useAccountApi`, `useIdentityApi`, `useSecurityLevel`, transport setup (`initGrpc`, `initAccountApi`)
- **Components** -- `SidLoginForm`, `SidRegistrationForm`, `SidMfaChallenge`, `SidPrincipalInput`, profile management pages
- **Utilities** -- `normalizePrincipal`, `detectLoginInputType`, `rpcRefusal`, email checks (`initEmail`, `checkEmail`, `isValidEmail`), validators, formatters

The generated messages and clients, the `google.rpc` error model and the gRPC-web / WebTransport transport live in `@structured-id/proto`; import them from there (`@structured-id/proto/sid/v1/identity/identity.client`, `@structured-id/proto/transport`).

### Migration from the previous exports

The root no longer re-exports generated clients, messages or enums, and the
`./proto` subpath is removed. Import those symbols from their schema modules in
`@structured-id/proto`. The `./browser-vp` prototype subpath is also removed;
this package does not provide a replacement browser-presentation implementation.
The Vue composables and components keep their UI package owners.

## Usage

```ts
import { getTransport, initGrpc } from "@structured-id/ui-core";
import { SidLoginForm, createAuth } from "@structured-id/ui-core/profile";
import { IdentityServiceClient } from "@structured-id/proto/sid/v1/identity/identity.client";
import { loadZkppClient } from "@structured-id/opaque";

// Initialize gRPC transport
initGrpc({ baseUrl: "http://localhost:9080" });
const identity = new IdentityServiceClient(getTransport());

// Password ceremonies (register, login, change, reset) on the app's client
const { login } = createAuth(() => loadZkppClient());
```

### Email addresses

Email fields are checked with [`@structured-world/structured-email-address-wasm`](https://www.npmjs.com/package/@structured-world/structured-email-address-wasm),
the parser the server itself uses, compiled to WebAssembly with the Public
Suffix List embedded (no network). Each namespace's admission mirrors the
server's email policy: `LOCAL` (an installation's own accounts: internal and
internationalized domains), `CORPORATE_BASELINE`, `GLOBAL_PERSONAL` (ASCII, no
IDN, a public mail domain). The server still decides; the field refuses only
what that namespace never admits.

Load the parser once at start and name the application's namespace (`LOCAL`
when omitted). The parser is loaded lazily as its own chunk; until it is,
`checkEmail` answers `pending` and `SidPrincipalInput` keeps the form's submit
disabled. A field accepting email starts the load itself if the application
did not.

```ts
import { GLOBAL_PERSONAL, initEmail } from "@structured-id/ui-core";

await initEmail({ policy: GLOBAL_PERSONAL });
```

## Development

The package ships its TypeScript and Vue sources; the consuming application's
bundler (Vite under Quasar) compiles them, so there is no build step.

```bash
yarn install
yarn test        # Run tests (vitest)
yarn typecheck   # vue-tsc --noEmit
node ci/check-package.mjs # Pack and build an external Vue/Vite consumer
```

## Architecture

```
src/
  composables/     # Vue 3 composition API, transport setup
  stores/          # Pinia stores (auth)
  profile/         # Profile components and composables
    components/    # SidLoginForm, SidRegistrationForm, SidMfaChallenge
    composables/   # createAuth, useAuthApi, useAccountApi, useIdentityApi
  utils/           # normalizePrincipal, rpcRefusal, validators, formatters
```

## License

AGPL-3.0-only -- see [LICENSE](LICENSE) for details.
