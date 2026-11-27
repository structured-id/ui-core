# Changelog

## [0.1.1](https://github.com/structured-id/ui-core/compare/ui-profile-v0.1.0...ui-profile-v0.1.1) (2026-11-27)


### Bug Fixes

* **ui-profile:** registration follows published settings ([#173](https://github.com/structured-id/ui-core/issues/173)) ([721f320](https://github.com/structured-id/ui-core/commit/721f3201a7a92a4ecfde13ce98838ee518e469c4)), closes [#172](https://github.com/structured-id/ui-core/issues/172)

## 0.1.0 (2026-11-26)


### ⚠ BREAKING CHANGES

* useAuth (session state) and useOpaqueAuth are removed; use createAuth. completePasswordReset takes the operation id and a PasswordRegistrationProof. SidRegistrationForm registerFn receives (identifier, password, extras { inviteCode?, claimToken? }) and a progress callback. initBff takes no cookie name and bffCsrfToken answers after checkBffSession. Account composables need initAccountApi at startup; startBffLogin returns to a path. oauth2Authorize requires issuerHandle. passwordOperationMessage and ERROR_KEYS are removed; use refusalMessage and REFUSAL_TEXTS. The generated Principal no longer has subjectType or subjectId, and PrincipalSubjectType is gone.

### Features

* CE account and administration applications ([#136](https://github.com/structured-id/ui-core/issues/136)) ([0b6b22a](https://github.com/structured-id/ui-core/commit/0b6b22ae420499684d5d33d599778b805c694992)), closes [#135](https://github.com/structured-id/ui-core/issues/135)
* password ceremonies on the ZKPP client as a major release ([d443918](https://github.com/structured-id/ui-core/commit/d4439187d22c05088a9fbc2aa2f4c902e2610939))
* **profile:** sign in through a registered entry connection ([#144](https://github.com/structured-id/ui-core/issues/144)) ([a4ace12](https://github.com/structured-id/ui-core/commit/a4ace12f79fa725d8fa7e42fb84f8fa01744abec)), closes [#143](https://github.com/structured-id/ui-core/issues/143)
* **profile:** sign-in page offers what its issuer offers ([#146](https://github.com/structured-id/ui-core/issues/146)) ([6657c74](https://github.com/structured-id/ui-core/commit/6657c745417d6b7b1c45f19529c2d4196f5168be)), closes [#145](https://github.com/structured-id/ui-core/issues/145)
* **ui-admin:** run the console in the installation's own session ([#139](https://github.com/structured-id/ui-core/issues/139)) ([7ef8860](https://github.com/structured-id/ui-core/commit/7ef88600668955d2135c08dfb5c2aa2126fbd066)), closes [#138](https://github.com/structured-id/ui-core/issues/138)
* **ui-profile:** add a passkey from the security page ([#161](https://github.com/structured-id/ui-core/issues/161)) ([ad0c7a1](https://github.com/structured-id/ui-core/commit/ad0c7a1771cafbfcc144c6db827d3f0ccb0b4b1a)), closes [#160](https://github.com/structured-id/ui-core/issues/160)


### Bug Fixes

* **profile:** passkey sign-in and no assumed sign-in offer ([#148](https://github.com/structured-id/ui-core/issues/148)) ([a99327c](https://github.com/structured-id/ui-core/commit/a99327c57ff5fe2635d7a766d2d34b9478f4a9cb)), closes [#147](https://github.com/structured-id/ui-core/issues/147)
* **submodule:** retarget proto to GitHub initial commit ([357c67d](https://github.com/structured-id/ui-core/commit/357c67d00d93a49cf2bc7694b336651aef672ebe))
* **ui-admin:** icon set and empty state under a refusal ([#141](https://github.com/structured-id/ui-core/issues/141)) ([30956c8](https://github.com/structured-id/ui-core/commit/30956c86a07169ad85b831f6069d82b3cfc94206)), closes [#140](https://github.com/structured-id/ui-core/issues/140)
