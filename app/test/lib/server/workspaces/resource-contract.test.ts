import { getTableColumns, getTableName, is } from "drizzle-orm";
import { getTableConfig, PgColumn, pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { type WorkspaceScopedResource, workspaceOwnershipColumns } from "@/lib/server/workspaces/resource-contract";

describe("workspaceOwnershipColumns", () => {
  test("exposes both workspace_id and created_by_user_id columns as PgColumn builders", () => {
    const sampleTable = pgTable("sample_resource", {
      id: text("id").primaryKey(),
      ...workspaceOwnershipColumns(),
    });

    const columns = getTableColumns(sampleTable);
    expect(columns).toHaveProperty("workspaceId");
    expect(columns).toHaveProperty("createdByUserId");
    expect(is(columns.workspaceId, PgColumn)).toBe(true);
    expect(is(columns.createdByUserId, PgColumn)).toBe(true);
  });

  test("workspace_id column is not nullable while created_by_user_id is nullable", () => {
    const sampleTable = pgTable("sample_resource_two", {
      id: text("id").primaryKey(),
      ...workspaceOwnershipColumns(),
    });

    const columns = getTableColumns(sampleTable);
    expect(columns.workspaceId.notNull).toBe(true);
    expect(columns.createdByUserId.notNull).toBe(false);
  });

  test("declares foreign keys to the workspace and user tables with the right delete behaviors", () => {
    const sampleTable = pgTable("sample_resource_three", {
      id: text("id").primaryKey(),
      ...workspaceOwnershipColumns(),
    });

    // `getTableConfig().foreignKeys` eagerly resolves the lazy reference
    // callbacks passed to `.references(...)` in the contract, so it also
    // acts as coverage for those closures.
    const config = getTableConfig(sampleTable);

    const workspaceFk = config.foreignKeys.find((fk) => fk.reference().columns.some((col) => col.name === "workspace_id"));
    expect(workspaceFk).toBeDefined();
    expect(getTableName(workspaceFk?.reference().foreignTable as never)).toBe("workspace");
    expect(workspaceFk?.onDelete).toBe("cascade");

    const userFk = config.foreignKeys.find((fk) => fk.reference().columns.some((col) => col.name === "created_by_user_id"));
    expect(userFk).toBeDefined();
    expect(getTableName(userFk?.reference().foreignTable as never)).toBe("user");
    expect(userFk?.onDelete).toBe("set null");
  });

  test("contract type allows a null creator after account lifecycle clears it", () => {
    const afterAccountDeletion: WorkspaceScopedResource = {
      id: "r_1",
      workspaceId: "ws_1",
      createdByUserId: null,
    };
    expect(afterAccountDeletion.createdByUserId).toBeNull();
  });
});
