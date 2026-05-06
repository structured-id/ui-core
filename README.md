# @structured-id/ui-core

Shared UI package for StructuredID applications. Provides Vue 3 composables, Pinia stores, protobuf-ts generated clients, and reusable components.

## What's Inside

- **Proto clients** -- gRPC-Web clients generated from [proto](https://github.com/structured-id/proto) via protobuf-ts
- **Composables** -- `useAuth`, `useAuthApi`, `useAccountApi`, `useIdentityApi`, `useSecurityLevel`, `useOpaqueAuth`
- **Components** -- `SidLoginForm`, `SidRegistrationForm`, `SidMfaChallenge`, `SidPrincipalInput`, profile management pages
- **Utilities** -- `normalizePrincipal`, `detectLoginInputType`, validators, formatters

## Usage

```ts
import { useAuth, getTransport, initGrpc } from "@structured-id/ui-core";
import { SidLoginForm } from "@structured-id/ui-core/profile";

// Initialize gRPC transport
initGrpc({ baseUrl: "http://localhost:9080" });
```

## Development

```bash
yarn install
yarn build       # Build library
yarn test        # Run tests (vitest)
yarn typecheck   # vue-tsc --noEmit
```

## Architecture

```
src/
  composables/     # Vue 3 composition API (useAuth, useAuthApi)
  stores/          # Pinia stores (auth)
  profile/         # Profile components and composables
    components/    # SidLoginForm, SidRegistrationForm, SidMfaChallenge
    composables/   # useOpaqueAuth, useAccountApi, useIdentityApi
  utils/           # normalizePrincipal, validators, formatters
  generated/       # protobuf-ts generated clients (do not edit)
  proto/           # Proto definitions submodule
```

## License

AGPL-3.0-only -- see [LICENSE](LICENSE) for details.
