# @structured-id/ui-core

Shared UI package for StructuredID applications. Provides Vue 3 composables, Pinia stores, protobuf-ts generated clients, and reusable components.

## What's Inside

- **Proto clients** -- gRPC-Web clients generated from [proto](https://github.com/structured-id/proto) via protobuf-ts
- **Composables** -- `createAuth` (password ceremonies over an injected ZKPP client), `useAuthApi`, `useAccountApi`, `useIdentityApi`, `useSecurityLevel`
- **Components** -- `SidLoginForm`, `SidRegistrationForm`, `SidMfaChallenge`, `SidPrincipalInput`, profile management pages
- **Utilities** -- `normalizePrincipal`, `detectLoginInputType`, validators, formatters

## Usage

```ts
import { getTransport, initGrpc } from "@structured-id/ui-core";
import { SidLoginForm, createAuth } from "@structured-id/ui-core/profile";
import { loadZkppClient } from "@structured-id/opaque";

// Initialize gRPC transport
initGrpc({ baseUrl: "http://localhost:9080" });

// Password ceremonies (register, login, change, reset) on the app's client
const { login } = createAuth(() => loadZkppClient());
```

## Development

The package ships its TypeScript and Vue sources; the consuming application's
bundler (Vite under Quasar) compiles them, so there is no build step.

```bash
yarn install
yarn generate    # Proto clients into src/generated
yarn test        # Run tests (vitest)
yarn typecheck   # vue-tsc --noEmit
```

## Architecture

```
src/
  composables/     # Vue 3 composition API
  stores/          # Pinia stores (auth)
  profile/         # Profile components and composables
    components/    # SidLoginForm, SidRegistrationForm, SidMfaChallenge
    composables/   # createAuth, useAuthApi, useAccountApi, useIdentityApi
  utils/           # normalizePrincipal, validators, formatters
  generated/       # protobuf-ts generated clients (do not edit)
  proto/           # Proto definitions submodule
```

## License

AGPL-3.0-only -- see [LICENSE](LICENSE) for details.
