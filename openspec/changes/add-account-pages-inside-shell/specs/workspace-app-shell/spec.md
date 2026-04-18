## MODIFIED Requirements

### Requirement: Workspace-scoped signed-in product routes render inside one shared shell
The system SHALL render workspace-scoped signed-in product routes and authenticated user-scoped account-settings routes (`/account/security`, `/account/close`) inside one shared authenticated shell. Workspace-scoped private routes include the workspace overview, the transcript library, the transcript detail page, the dedicated meeting-submission page, and the dedicated meeting-status page. For workspace-scoped routes, the shell's current-workspace context SHALL come from the explicit workspace route context defined by `workspace-foundation`, and session or remembered workspace state MUST NOT override that explicit route context. For authenticated account-settings routes hosted inside the shell, the shell SHALL resolve a current workspace context using the same default-workspace resolution defined by `workspace-foundation` for authenticated entry without an explicit workspace destination. Public share routes, authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor), the minimal account gates `/account/recent-auth` and `/account/closed`, and the authenticated dashboard entry point (`/dashboard`) MUST remain outside the shared shell.

#### Scenario: User opens a workspace page inside the shared shell
- **WHEN** a verified authenticated user with access to workspace `w/[slug]` opens the workspace overview or another workspace-scoped private route
- **THEN** the page renders inside the shared shell with the current workspace context preserved from the explicit route slug

#### Scenario: User navigates within the same workspace
- **WHEN** a user moves from one private route in `w/[slug]` to another private route in the same workspace
- **THEN** the shared shell remains available and keeps the same current-workspace identity for the new page

#### Scenario: User opens an authenticated account settings page inside the shared shell
- **WHEN** a verified authenticated user opens `/account/security` or `/account/close`
- **THEN** the page renders inside the shared shell with a current workspace context resolved from the user's default workspace

#### Scenario: Workspace-scoped shell chrome targets the resolved workspace on account routes
- **WHEN** a user on an account shell route uses the sidebar workspace switcher, the header upload control, the drop overlay, or sees the upload-manager rehydration populate
- **THEN** those workspace-scoped shell features target the resolved default workspace

#### Scenario: Public, authentication, account-gate, and dashboard pages remain outside the shell
- **WHEN** a user opens a public share route, an authentication route (sign-in, sign-up, verify-email, forgot-password, reset-password, or two-factor), `/account/recent-auth`, `/account/closed`, or the authenticated dashboard entry point (`/dashboard`)
- **THEN** the system does not render the shared shell around that page

### Requirement: The shell renders a workspace-rooted breadcrumb band above page content
The shared workspace shell SHALL render a sticky breadcrumb band directly above page content. On workspace-scoped routes the breadcrumb MUST always begin with the current workspace name so workspace identity is never lost. On authenticated account-settings routes inside the shell, the breadcrumb MUST begin with a non-workspace content root (for example `Account`) and MUST NOT use the resolved default workspace name as the root crumb on those routes; workspace identity on account routes is carried by the sidebar workspace switcher alone. Pages MAY push a human-readable label for the final crumb so the band never shows a raw identifier. The breadcrumb band MUST apply explicit truncation rules: the final (page-title) crumb truncates first with a full-title tooltip, middle crumbs collapse into an ellipsis-dropdown when the chain still overflows, and the root crumb (workspace or account) never shrinks. The breadcrumb band MUST NOT carry live transcript-processing state.

#### Scenario: Breadcrumb begins with the workspace on workspace-scoped routes
- **WHEN** a user opens any workspace-scoped private route inside the shared shell
- **THEN** the breadcrumb band begins with the current workspace name

#### Scenario: Breadcrumb begins with the account root on account routes
- **WHEN** a user opens `/account/security` or `/account/close` inside the shared shell
- **THEN** the breadcrumb band begins with a non-workspace content root such as `Account` instead of the resolved workspace name

#### Scenario: Page pushes a human-readable final crumb
- **WHEN** a shell-hosted page has a human-readable final crumb such as a transcript display title
- **THEN** the breadcrumb band renders that human-readable label as the final crumb instead of a raw identifier

#### Scenario: Final crumb truncates first
- **WHEN** the breadcrumb chain exceeds the available width and the final crumb can still be shortened to fit
- **THEN** the final crumb truncates first with a full-title tooltip while other crumbs stay full-width

#### Scenario: Middle crumbs collapse when truncation is not enough
- **WHEN** the breadcrumb chain still overflows after the final crumb is truncated
- **THEN** middle crumbs collapse into an ellipsis-dropdown while the root crumb stays visible

#### Scenario: Root crumb never shrinks
- **WHEN** the breadcrumb chain is under truncation pressure on any shell-hosted route
- **THEN** the root crumb (workspace name on workspace routes, account root on account routes) never shrinks

#### Scenario: Breadcrumb band does not surface processing state
- **WHEN** transcript processing is in progress for the current workspace
- **THEN** the breadcrumb band does not display that processing state
