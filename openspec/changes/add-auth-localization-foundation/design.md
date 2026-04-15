## Context

The reduced bootstrap intentionally removed full-app auth localization so the platform foundation could stay focused on runtime and identity. The auth system still needs a shared locale model, but that concern stands on its own and benefits from a smaller, dedicated change.

This change establishes the localization foundation for:

- authentication surfaces
- Better Auth error messages
- shared application chrome

It does not invent translation requirements for future product surfaces that do not exist yet.

## Goals / Non-Goals

**Goals:**

- Support English, French, German, and Spanish across auth flows and shared chrome.
- Keep Better Auth error messages aligned with the same locale model as the application.
- Define a single fallback story when locale data is missing or unsupported.

**Non-Goals:**

- Translating future transcript-management, sharing, or export surfaces before those surfaces exist.
- Changing the auth logic itself beyond the locale plumbing needed to render it.

## Decisions

### Decision: Use one shared locale model for auth surfaces and shared chrome

The application will resolve locale once and use that same locale for:

- auth page copy
- shared application chrome
- Better Auth error and status messages

This prevents the common failure mode where the app renders one locale while auth errors appear in another.

### Decision: Support `en`, `fr`, `de`, and `es` with English fallback

The supported locale set for this foundation is fixed to:

- `en`
- `fr`
- `de`
- `es`

When the user's preferred locale is unsupported or translation data is missing, the app falls back to English.

### Decision: Only localize surfaces that already exist

This change localizes the auth flows and shared chrome that are already part of the app platform. It does not create speculative translation keys for transcript features that will be added later.

That keeps the localization scope proportional to the actual product surface present at implementation time.

## Risks / Trade-offs

- [Locale plumbing can sprawl if every route handles it differently] -> Resolve locale centrally and have auth routes plus shared chrome read from the same source.
- [Translation assets can drift from Better Auth error keys] -> Integrate Better Auth i18n through the same locale layer and add regression coverage for error rendering.

## Migration Plan

1. Establish the shared locale model and supported language set.
2. Add translation catalogs for the auth and shared-chrome surfaces that already exist.
3. Integrate Better Auth i18n into the same locale pipeline.
4. Add regression coverage for supported locales and English fallback.

## Open Questions

None are blocking for this change. Future product surfaces will add their own translation keys when those surfaces are introduced.
