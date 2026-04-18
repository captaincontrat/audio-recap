# workspace-app-shell Specification

## Purpose

Defines the shared authenticated shell for workspace-scoped private routes. The shell wraps the workspace overview, the transcript library, the transcript detail page, the dedicated meeting-submission page, and the dedicated meeting-status page in a single layout that preserves workspace identity through workspace-aware sidebar navigation, surfaces a thin header ribbon with a reserved (non-input) workspace search position and a shadcn `CommandDialog`-based pre-launch command surface, renders a sticky workspace-rooted breadcrumb band directly above page content, and exposes workspace-scoped upload chrome — a global drag-and-drop target inside the shell, an explicit header upload control, a drop-then-confirm handoff, and a persistent workspace-scoped upload manager that carries submissions from local upload phases into the existing transcript-processing lifecycle. Inherits the explicit workspace route context, role-based access model, and archived-workspace behavior from `workspace-foundation` rather than inventing a separate access model. Does not host non-workspace authenticated routes (`/account/*`, public share routes, authentication routes, `/dashboard`); those belong to follow-up changes.

## Requirements

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

### Requirement: The shell exposes workspace-scoped upload entry points with confirmation before queueing
The shared workspace shell SHALL expose workspace-scoped upload entry points for meeting media in the current workspace. The shell MUST support a global drag-and-drop target anywhere inside the shared shell and an explicit header-level upload control. Both entry points MUST open the same drop-then-confirm handoff associated with the current workspace. While a user drags a supported file over the shared shell, the system MUST show a current-workspace drop overlay that identifies the target workspace. Dropping the file or activating the header upload control MUST open the confirmation handoff and MUST allow the user to review the file and optionally add notes before any upload begins. The system MUST NOT upload media or queue transcript processing until the user explicitly confirms the handoff. Users without transcript-creation access in the current workspace MUST NOT receive an accepting drop target and MUST NOT see an active header upload control, and archived workspaces MUST NOT accept queueable shell submissions.

#### Scenario: Supported file drag opens the current-workspace confirmation handoff
- **WHEN** a user with transcript-creation access drags and drops one supported meeting file anywhere inside the shared shell for workspace `w/[slug]`
- **THEN** the system shows a drop overlay that identifies `w/[slug]` as the target workspace and opens a confirmation handoff associated with `w/[slug]` before upload starts

#### Scenario: Header upload control opens the same confirmation handoff
- **WHEN** a user with transcript-creation access activates the shell's header upload control in workspace `w/[slug]`
- **THEN** the system opens the same drop-then-confirm handoff associated with `w/[slug]` that a file drop would have opened

#### Scenario: User cancels the drop handoff
- **WHEN** a user drops a supported file into the shared shell but cancels the confirmation handoff
- **THEN** the system does not upload the file and does not create queued transcript work

#### Scenario: Read-only user cannot queue work from the shell
- **WHEN** a user without transcript-creation access in the current workspace drags a file over the shared shell or looks at the shell header
- **THEN** the shell does not accept the drop as a queueable transcript submission for that workspace and does not present an active header upload control

#### Scenario: Archived workspace does not accept shell-level submission
- **WHEN** a user with transcript-creation access drags a file over the shared shell or looks at the shell header in a current workspace that is archived
- **THEN** the shell does not accept the drop as a queueable transcript submission and does not present an active header upload control

### Requirement: The shell hosts a persistent workspace-scoped upload manager
The shared workspace shell SHALL host a persistent floating upload manager scoped to the current workspace. The upload manager MUST show shell-level submissions from their local submission phases through the transcript-processing lifecycle once queueing succeeds, using the same lifecycle vocabulary defined by `meeting-import-processing` (`queued`, `preprocessing`, `transcribing`, `generating_recap`, `generating_title`, `finalizing`, `retrying`, `completed`, `failed`). The upload manager MUST also rehydrate its visible queue from the workspace's non-terminal transcripts when the shell mounts, so in-progress work survives page reloads and navigation back into the workspace. The upload manager MUST support multiple concurrent items in the same current workspace and MUST remain scoped so one workspace's in-flight submissions are never shown while the user is viewing another workspace. Each non-draft item MUST offer a route into the transcript's dedicated private status or detail surface when that resource becomes available. Terminal items MAY be dismissed by the user from the upload manager, and the upload manager MUST keep failed items visible for the current workspace session until the user dismisses them. Dismissal MUST be client-only and MUST NOT delete the underlying transcript record.

#### Scenario: Accepted shell submission appears in the upload manager
- **WHEN** a user confirms a shell-level meeting submission in the current workspace
- **THEN** the upload manager shows that submission's local progress and continues showing the transcript-processing lifecycle after queueing succeeds

#### Scenario: Upload manager rehydrates in-progress work from the workspace
- **WHEN** a user opens the shared shell for workspace `w/[slug]` and that workspace has one or more non-terminal transcripts the user can read
- **THEN** the upload manager shows those transcripts with their current processing status without requiring a new shell submission

#### Scenario: Upload manager merges rehydrated and in-session items by transcript id
- **WHEN** a shell-level submission in workspace `w/[slug]` reaches queued state during the session and the shell then rehydrates non-terminal transcripts for `w/[slug]`
- **THEN** the upload manager shows exactly one item for that transcript, merging the in-session item and the rehydrated item by transcript id

#### Scenario: Upload manager shows multiple concurrent submissions
- **WHEN** a user has more than one shell submission in the current workspace that has not yet reached a terminal state
- **THEN** the upload manager shows each submission as its own item with its own current state

#### Scenario: Upload manager persists across same-workspace navigation
- **WHEN** a user starts a shell-level submission in workspace `w/[slug]` and then navigates to another private route in the same workspace
- **THEN** the upload manager remains visible for `w/[slug]` and preserves the submission's current state

#### Scenario: Upload manager does not leak cross-workspace activity
- **WHEN** a user starts a shell-level submission in workspace `w/[slug-a]` and then opens a private route in workspace `w/[slug-b]`
- **THEN** the shared shell for `w/[slug-b]` does not show the in-flight upload-manager item from `w/[slug-a]`

#### Scenario: User dismisses a terminal item
- **WHEN** a user dismisses a terminal upload-manager item in the current workspace
- **THEN** the upload manager removes that item from the visible queue for that workspace without changing the underlying transcript record

#### Scenario: Failed items remain pinned until dismissed
- **WHEN** a shell-level submission in the current workspace reaches a terminal failed state and the user has not yet dismissed the item
- **THEN** the upload manager keeps the failed item visible for the current workspace session
