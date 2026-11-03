import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HTTP_METHODS,
  ID_ROUTE_CASES,
  ID_ROUTE_MODULES,
  type HttpMethod,
} from "./helpers/id-routes";

const API_ROOT = path.join(process.cwd(), "src", "app", "api");

/** Same as globbing src/app/api/[id-segment]/route.ts, without brackets in the pattern. */
function idRouteFiles() {
  return readdirSync(API_ROOT, { recursive: true, encoding: "utf8" })
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => file.endsWith("route.ts") && /(^|\/)\[[^\]]+\]\//.test(file))
    .sort();
}

function exportedMethods(routeModule: object) {
  return HTTP_METHODS.filter((method) => method in routeModule);
}

describe("every [id] route is in the two-workspace table", () => {
  it("finds the routes on disk", () => {
    expect(idRouteFiles().length).toBeGreaterThanOrEqual(14);
  });

  it("has a module entry for each route file, and none for a removed file", () => {
    expect(Object.keys(ID_ROUTE_MODULES).sort()).toEqual(idRouteFiles());
  });

  it("has a case for each exported method, and none for a method that is gone", () => {
    const expected = Object.entries(ID_ROUTE_MODULES).flatMap(([file, routeModule]) =>
      exportedMethods(routeModule).map((method: HttpMethod) => `${method} ${file}`),
    );
    const covered = ID_ROUTE_CASES.map(({ method, file }) => `${method} ${file}`);

    expect([...new Set(covered)].sort()).toEqual(expected.sort());
  });
});
