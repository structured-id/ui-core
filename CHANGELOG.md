## [2.0.0](https://github.com/structured-id/ui-core/compare/v1.3.0...v2.0.0) (2026-10-07)

### ⚠ BREAKING CHANGES

* useAuth (session state) and useOpaqueAuth are removed;
use createAuth. completePasswordReset takes the operation id and a
PasswordRegistrationProof. SidRegistrationForm registerFn receives
(identifier, password, extras { inviteCode?, claimToken? }) and a progress
callback. initBff takes no cookie name and bffCsrfToken answers after
checkBffSession. Account composables need initAccountApi at startup;
startBffLogin returns to a path. oauth2Authorize requires issuerHandle.
passwordOperationMessage and ERROR_KEYS are removed; use refusalMessage
and REFUSAL_TEXTS. The generated Principal no longer has subjectType or
subjectId, and PrincipalSubjectType is gone.

### Features

* password ceremonies on the ZKPP client as a major release ([5ba1e7b](https://github.com/structured-id/ui-core/commit/5ba1e7bac6d8ba42a6a7ad97e890639c24694f13))

## [3.0.0](https://github.com/structured-id/ui-core/compare/v2.0.0...v3.0.0) (2026-10-10)


### ⚠ BREAKING CHANGES

* **auth:** `changePassword(credentialId, newPassword, onProgress)` becomes `changePassword({ credentialId, newPassword, currentPassword }, onProgress)`; `RegistrationProgress` is replaced by `PasswordOperationProgress`; `ZkppClientApi.loginFinish` takes the OPAQUE context as a fourth argument.
* **ui:** consume generated SDK clients ([#12](https://github.com/structured-id/ui-core/issues/12))

### Features

* **auth:** password ceremony and current-password proof in a change ([#14](https://github.com/structured-id/ui-core/issues/14)) ([e193e27](https://github.com/structured-id/ui-core/commit/e193e27ed6af92ea48c0cba4b747e9c651a39563)), closes [#13](https://github.com/structured-id/ui-core/issues/13)


### Code Refactoring

* **ui:** consume generated SDK clients ([#12](https://github.com/structured-id/ui-core/issues/12)) ([ed32342](https://github.com/structured-id/ui-core/commit/ed32342180ec9a81e5c5396263d0911e63d0f0b0)), closes [#11](https://github.com/structured-id/ui-core/issues/11)

## [1.3.0](https://github.com/structured-id/ui-core/compare/v1.2.0...v1.3.0) (2026-10-07)

### ⚠ BREAKING CHANGES

* useAuth (session state) and useOpaqueAuth are removed;
use createAuth. completePasswordReset takes the operation id and a
PasswordRegistrationProof. SidRegistrationForm registerFn receives
(identifier, password, extras { inviteCode?, claimToken? }) and a progress
callback. initBff takes no cookie name and bffCsrfToken answers after
checkBffSession. Account composables need initAccountApi at startup;
startBffLogin returns to a path. oauth2Authorize requires issuerHandle.
passwordOperationMessage and ERROR_KEYS are removed; use refusalMessage
and REFUSAL_TEXTS. The generated Principal no longer has subjectType or
subjectId, and PrincipalSubjectType is gone.

### Features

* password ceremonies on the ZKPP client ([dbf129f](https://github.com/structured-id/ui-core/commit/dbf129fa4c4d2a1590860fd2161793ec7a626c64)), closes [structured-id/opaque#2](https://github.com/structured-id/opaque/issues/2)

## [1.2.0](https://github.com/structured-id/ui-core/compare/v1.1.0...v1.2.0) (2026-05-07)

### Features

* **profile:** enforce 6-char min username on registration ([5808c55](https://github.com/structured-id/ui-core/commit/5808c554ecacdecb17723edf40b57c66fbef0968))

## [1.1.0](https://github.com/structured-id/ui-core/compare/v1.0.1...v1.1.0) (2026-05-07)

### Features

* **profile:** add showConfirmPassword prop to SidRegistrationForm ([12efca1](https://github.com/structured-id/ui-core/commit/12efca1341a213f6b7c08da594b143d530f22d56))

## [1.0.1](https://github.com/structured-id/ui-core/compare/v1.0.0...v1.0.1) (2026-05-06)

### Bug Fixes

* **npm:** add repository field for provenance verification ([019015f](https://github.com/structured-id/ui-core/commit/019015f10daf14ea583540a94b7b6025fc015af5))

## 1.0.0 (2026-05-06)

### Features

* **ci:** add PR validation workflow ([653b6a8](https://github.com/structured-id/ui-core/commit/653b6a858b588ba8ee1a9618d89b19bcee458473))

### Bug Fixes

* **ci:** drop @semantic-release/npm — use exec publishCmd for OIDC ([622b745](https://github.com/structured-id/ui-core/commit/622b7450dfad5f6b82cdd8ed124d5d3b601e7bd0))
* **ci:** use GitHub App token for semantic-release (mirror gitlab-mcp pattern) ([fa2ee7f](https://github.com/structured-id/ui-core/commit/fa2ee7f6a47f36925e8ae380496fbd7bb0557a57))
* **submodule:** retarget proto to GitHub HEAD ([c4e9236](https://github.com/structured-id/ui-core/commit/c4e9236a7887f28fd3bedeb238d2eef15e56ec49))
* **submodule:** retarget proto to GitHub initial commit ([a1e59d0](https://github.com/structured-id/ui-core/commit/a1e59d05c2e1b881ac3b61e8fe4eb56460973b4d))
