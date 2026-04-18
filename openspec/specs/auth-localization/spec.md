# auth-localization Specification

## Purpose

Defines the shared locale model for the Summitdown web app: how the active locale is detected, persisted, and consumed across authentication surfaces, shared application chrome, and Better Auth error messages. This capability owns the supported-language set (English, French, German, Spanish), the English fallback contract, and the rule that auth errors render in the same locale as the rest of the app — providing a single source of truth that downstream capabilities (account management, dashboards, transcript surfaces) can build on without re-deriving locale state.

## Requirements

### Requirement: The web app supports localization across supported languages
The system SHALL support full-app localization for English, French, German, and Spanish. Authentication surfaces, shared application chrome, and Better Auth error messages MUST resolve from the same locale model. When the user's preferred locale is unsupported or unavailable, the system MUST fall back to English.

#### Scenario: Supported locale renders the app in that locale
- **WHEN** a user visits the web app with a supported preferred locale of French, German, or Spanish
- **THEN** the app renders localized UI content for that locale, including authentication surfaces and shared application chrome

#### Scenario: Auth errors use the same locale as the app
- **WHEN** an auth flow returns a Better Auth error while the app locale is French, German, or Spanish
- **THEN** the system returns the translated auth error message in that same locale

#### Scenario: Unsupported locale falls back to English
- **WHEN** a user visits the app with a preferred locale that is not one of the supported locales
- **THEN** the app falls back to English content and English Better Auth error messages
