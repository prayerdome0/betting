import { startupFailureResponse } from "@/lib/server/startup";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
// Loaded lazily for the same reason as /api/command: a module the deployment
// cannot load must be reported as JSON, not as a bodiless HTTP 500.
async function service() {
  return import("@/lib/server/admin-service");
}
export async function GET(request: Request) {
  let admin: Awaited<ReturnType<typeof service>>;
  try {
    admin = await service();
  } catch (error) {
    return startupFailureResponse("/api/admin", error);
  }
  return admin.handleAdminGet(request);
}
export async function POST(request: Request) {
  let admin: Awaited<ReturnType<typeof service>>;
  try {
    admin = await service();
  } catch (error) {
    return startupFailureResponse("/api/admin", error);
  }
  return admin.handleAdminPost(request);
}
