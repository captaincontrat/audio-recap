## ADDED Requirements

### Requirement: Workspace-scoped signed-in product routes render inside one shared shell
The system SHALL render workspace-scoped signed-in product routes inside one shared authenticated shell. Workspace-scoped private routes include the workspace overview, the transcript library, the transcript detail page, the dedicated meeting-submission page, and the dedicated meeting-status page. For these routes, the shell's current-workspace context SHALL come from the explicit workspace route context defined by `workspace-foundation`, and session or remembered workspace state MUST NOT override that explicit route context. Public share routes, authentication routes (sign-in, sign-up, verify-email, forgot-password, reset-password, two-factor), authenticated account routes (`/account/security`, `/account/close`, `/account/recent-auth`, `/account/closed`), and the authenticated dashboard entry point (`/dashboard`) MUST remain outside the shared shell in this change.

#### Scenario: User opens a workspace page inside the shared shell
- **WHEN** a verified authenticated user with access to workspace `w/[slug]` opens the workspace overview or another workspace-scoped private route
- **THEN** the page renders inside the shared shell with the current workspace context preserved from the explicit route slug

#### Scenario: User navigates within the same workspace
- **WHEN** a user moves from one private route in `w/[slug]` to another private route in the same workspace
- **THEN** the shared shell remains available and keeps the same current-workspace identity for the new page

#### Scenario: Non-workspace pages remain outside the shell
- **WHEN** a user opens a public share route, an authentication route, an `/account/*` route, or the authenticated dashboard entry point
- **THEN** the system does not render the shared shell around that page

### Requirement: The shell provides workspace-aware navigation and a reserved header search position
The shared workspace shell SHALL provide persistent workspace-aware navigation and a reserved header position for future workspace search. The sidebar navigation MUST expose at least the current workspace overview and the transcript library destinations, MUST indicate which destination matches the current route, and MUST support an icon-collapsed mode that preserves every destination. The sidebar MUST also surface workspace identity through a workspace switcher region. The header MUST reserve a stable position for a future workspace search affordance, but this change MUST NOT render a functional workspace search input or a fake text input that simulates workspace search. The reserved header position MAY use a non-input affordance such as an icon control with a visible keyboard-shortcut hint that adapts to the user's platform. Activating the reserved search affordance, or pressing the platform-adapted shortcut from anywhere inside the shell, MUST open a pre-launch command surface that accepts typing but honestly signals that workspace search is not yet available. The platform-adapted shortcut MUST NOT open that command surface while the active element is an input or textarea inside an active transcript edit session.

#### Scenario: Active route is reflected in sidebar navigation
- **WHEN** a user opens a private workspace route inside the shared shell
- **THEN** the sidebar shows the current destination as active within the current workspace navigation set

#### Scenario: Icon-collapsed sidebar preserves every destination
- **WHEN** a user collapses the sidebar to its icon rail
- **THEN** the workspace switcher, the Overview and Transcripts destinations, and the user footer actions all remain reachable without losing any destination

#### Scenario: Header reserves the search position without a fake input
- **WHEN** a user views a page inside the shared workspace shell before a dedicated workspace search capability is implemented
- **THEN** the header shows a stable non-input affordance in the reserved search position and does not render a text input that simulates workspace search

#### Scenario: Reserved search affordance opens a pre-launch command surface
- **WHEN** a user activates the reserved search affordance or presses the platform-adapted shortcut from anywhere in the shared shell
- **THEN** the system opens a pre-launch command surface that accepts typing and honestly signals that workspace search is not yet available

#### Scenario: Shortcut yields to active transcript edit sessions
- **WHEN** the user presses the platform-adapted search shortcut while an active transcript edit session owns focus on an input or textarea
- **THEN** the shared shell does not open the pre-launch command surface and lets the transcript edit session receive the keystroke

### Requirement: The shell renders a workspace-rooted breadcrumb band above page content
The shared workspace shell SHALL render a sticky breadcrumb band directly above page content. On workspace-scoped routes the breadcrumb MUST always begin with the current workspace name so workspace identity is never lost. Pages MAY push a human-readable label for the final crumb so the band never shows a raw identifier. The breadcrumb band MUST apply explicit truncation rules: the final (page-title) crumb truncates first with a full-title tooltip, middle crumbs collapse into an ellipsis-dropdown when the chain still overflows, and the workspace root crumb never shrinks. The breadcrumb band MUST NOT carry live transcript-processing state.

#### Scenario: Breadcrumb begins with the workspace on workspace-scoped routes
- **WHEN** a user opens any workspace-scoped private route inside the shared shell
- **THEN** the breadcrumb band begins with the current workspace name

#### Scenario: Page pushes a human-readable final crumb
- **WHEN** a workspace-scoped page has a human-readable final crumb such as a transcript display title
- **THEN** the breadcrumb band renders that human-readable label as the final crumb instead of a raw identifier

#### Scenario: Final crumb truncates first
- **WHEN** the breadcrumb chain exceeds the available width and the final crumb can still be shortened to fit
- **THEN** the final crumb truncates first with a full-title tooltip while other crumbs stay full-width

#### Scenario: Middle crumbs collapse when truncation is not enough
- **WHEN** the breadcrumb chain still overflows after the final crumb is truncated
- **THEN** middle crumbs collapse into an ellipsis-dropdown while the workspace root crumb stays visible

#### Scenario: Breadcrumb band does not surface processing state
- **WHEN** transcript processing is in progress for the current workspace
- **THEN** the breadcrumb band does not display that processing state
