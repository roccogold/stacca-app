export async function register() {
  const { assertProductionEnv } = await import("@/lib/env");
  assertProductionEnv();
}
