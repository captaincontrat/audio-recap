## Why

The original bootstrap bundled full-app auth localization into the same change as runtime and account foundations. That made the baseline much larger than necessary and mixed translation plumbing with unrelated auth/storage work.

This change isolates the locale model needed by authentication surfaces and the shared application chrome so localization can be implemented deliberately, tested well, and layered on top of the reduced auth foundation.

## What Changes

- Add locale detection and selection for the web app's auth surfaces and shared application chrome.
- Add shared translation loading for `en`, `fr`, `de`, and `es`.
- Integrate Better Auth i18n so auth errors resolve from the same locale model as the rest of the app.
- Define English fallback behavior when the user's preferred locale is unsupported or unavailable.

## Capabilities

### New Capabilities
- `auth-localization`: Locale detection, locale selection, shared translation loading, Better Auth i18n integration, and English fallback behavior for auth surfaces and shared app chrome.

### Modified Capabilities
- `core-account-authentication`: Gains localized auth copy and error presentation.
- `federated-and-passwordless-auth`: Gains localized sign-in method surfaces and auth-provider error messages.
- `account-security-hardening`: Gains localized second-factor and destructive-action UX.

## Impact

- `app/` gains a shared locale model that auth pages and common application chrome use consistently.
- Better Auth errors and application copy resolve from the same locale state instead of diverging.
- Translation assets and locale tests become part of the auth-platform baseline without forcing untranslated copy for product surfaces that do not exist yet.
