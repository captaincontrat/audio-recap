// Pure decision engine for authenticated-entry default landing. Given the
// available signals (explicit destination, last-valid remembered workspace,
// personal workspace), return which target the system should land the user
// on. The rule order is fixed by the spec:
//
//   1. preserve an explicit authorized destination (e.g. `returnTo`)
//   2. otherwise use the last successfully used workspace when it is still
//      accessible and active
//   3. otherwise fall back to the user's personal workspace
//
// Every DB-touching caller should feed the already-validated inputs into
// `resolveDefaultLanding` so the decision logic itself stays pure and
// unit-testable.

export type ExplicitDestination = {
  path: string;
  isAuthorized: boolean;
};

export type RememberedWorkspace = {
  workspaceId: string;
  slug: string;
  accessible: boolean;
  active: boolean;
};

export type PersonalWorkspaceRef = {
  workspaceId: string;
  slug: string;
};

export type LandingInputs = {
  explicitDestination: ExplicitDestination | null;
  lastValidWorkspace: RememberedWorkspace | null;
  personalWorkspace: PersonalWorkspaceRef;
};

export type LandingDecision =
  | { kind: "explicit"; path: string }
  | { kind: "last"; workspaceId: string; slug: string }
  | { kind: "personal"; workspaceId: string; slug: string };

// Use explicit destination first, then last valid workspace, then personal.
// Remembered workspaces that are no longer accessible or active are skipped
// so the fallback never lands the user in a stale workspace.
export function resolveDefaultLanding(inputs: LandingInputs): LandingDecision {
  const { explicitDestination, lastValidWorkspace, personalWorkspace } = inputs;

  if (explicitDestination && explicitDestination.isAuthorized) {
    return { kind: "explicit", path: explicitDestination.path };
  }

  if (lastValidWorkspace && lastValidWorkspace.accessible && lastValidWorkspace.active) {
    return {
      kind: "last",
      workspaceId: lastValidWorkspace.workspaceId,
      slug: lastValidWorkspace.slug,
    };
  }

  return {
    kind: "personal",
    workspaceId: personalWorkspace.workspaceId,
    slug: personalWorkspace.slug,
  };
}
