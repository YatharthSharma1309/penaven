import { assertIntegrationEnv } from "./env-guard";

/** Runs before any test file loads, so a bad environment never reaches the app code. */
export default function globalSetup() {
  assertIntegrationEnv();
}
