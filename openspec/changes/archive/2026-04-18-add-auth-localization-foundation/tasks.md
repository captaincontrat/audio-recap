## 1. Locale Model

- [x] 1.1 Implement shared locale detection and selection for the web app, including persistence of the active locale across auth surfaces and shared application chrome.
- [x] 1.2 Add the supported translation catalogs for `en`, `fr`, `de`, and `es`, with English as the fallback locale.

## 2. Auth Integration

- [x] 2.1 Integrate Better Auth i18n so auth errors and auth-driven UI states resolve from the same locale model as the rest of the app.
- [x] 2.2 Update the auth routes, screens, and shared application chrome to read translations from the shared locale model rather than from hard-coded strings.

## 3. Validation And Regression Coverage

- [x] 3.1 Add automated coverage for supported locale rendering across auth surfaces and shared application chrome.
- [x] 3.2 Add automated coverage for localized Better Auth errors and English fallback behavior when the preferred locale is unsupported.
