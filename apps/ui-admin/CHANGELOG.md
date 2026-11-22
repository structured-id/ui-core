# Changelog

## 0.1.0 (2026-11-22)


### ⚠ BREAKING CHANGES

* useAuth (session state) and useOpaqueAuth are removed; use createAuth. completePasswordReset takes the operation id and a PasswordRegistrationProof. SidRegistrationForm registerFn receives (identifier, password, extras { inviteCode?, claimToken? }) and a progress callback. initBff takes no cookie name and bffCsrfToken answers after checkBffSession. Account composables need initAccountApi at startup; startBffLogin returns to a path. oauth2Authorize requires issuerHandle. passwordOperationMessage and ERROR_KEYS are removed; use refusalMessage and REFUSAL_TEXTS. The generated Principal no longer has subjectType or subjectId, and PrincipalSubjectType is gone.

### Features

* CE account and administration applications ([#136](https://github.com/structured-id/ui-core/issues/136)) ([0b6b22a](https://github.com/structured-id/ui-core/commit/0b6b22ae420499684d5d33d599778b805c694992)), closes [#135](https://github.com/structured-id/ui-core/issues/135)
* password ceremonies on the ZKPP client as a major release ([d443918](https://github.com/structured-id/ui-core/commit/d4439187d22c05088a9fbc2aa2f4c902e2610939))
* **ui-admin:** run the console in the installation's own session ([#139](https://github.com/structured-id/ui-core/issues/139)) ([7ef8860](https://github.com/structured-id/ui-core/commit/7ef88600668955d2135c08dfb5c2aa2126fbd066)), closes [#138](https://github.com/structured-id/ui-core/issues/138)


### Bug Fixes

* **submodule:** retarget proto to GitHub initial commit ([357c67d](https://github.com/structured-id/ui-core/commit/357c67d00d93a49cf2bc7694b336651aef672ebe))
