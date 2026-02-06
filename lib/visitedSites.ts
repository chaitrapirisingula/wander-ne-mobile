import { get, ref, remove, set } from "firebase/database";
import { app, auth, db } from "../firebase";

function logDbError(operation: string, error: unknown) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isPermissionDenied = errMsg.toLowerCase().includes("permission");
  const dbUrl = (app.options as { databaseURL?: string }).databaseURL;
  const uid = auth.currentUser?.uid;
  const logPayload = {
    error,
    databaseURL: dbUrl || "(not set - check FIREBASE_DATABASE_URL in .env)",
    authUid: uid || "(not logged in)",
    projectId: app.options.projectId,
  };
  if (isPermissionDenied) {
    console.warn(
      `[Firebase DB] ${operation}: Permission denied. Add userVisitedSites rules in Firebase Console → Realtime Database → Rules. See FIREBASE_SECURITY_RULES.md`,
    );
  } else {
    console.error(`[Firebase DB] ${operation} failed:`, logPayload);
  }
}

export interface VisitedSite {
  id: string;
  name: string;
  city?: string;
  state?: string;
  image?: string;
  visitedAt: string;
}

export async function getVisitedSites(userId: string): Promise<VisitedSite[]> {
  try {
    const visitedRef = ref(db, `userVisitedSites/${userId}`);
    const snapshot = await get(visitedRef);
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    return Object.values(data) as VisitedSite[];
  } catch (error) {
    logDbError("getVisitedSites", error);
    return [];
  }
}

export async function addVisitedSite(
  userId: string,
  site: Omit<VisitedSite, "visitedAt">,
) {
  try {
    const visitedAt = new Date().toISOString();
    const visitedSite: VisitedSite = { ...site, visitedAt };

    const visitedRef = ref(db, `userVisitedSites/${userId}/${site.id}`);
    await set(visitedRef, visitedSite);
  } catch (error) {
    logDbError("addVisitedSite", error);
    throw error;
  }
}

export async function clearVisitedSites(userId: string) {
  try {
    const visitedRef = ref(db, `userVisitedSites/${userId}`);
    await remove(visitedRef);
  } catch (error) {
    logDbError("clearVisitedSites", error);
    throw error;
  }
}

export async function isSiteVisited(
  userId: string,
  siteId: string,
): Promise<boolean> {
  try {
    const visitedRef = ref(db, `userVisitedSites/${userId}/${siteId}`);
    const snapshot = await get(visitedRef);
    return snapshot.exists();
  } catch (error) {
    logDbError("isSiteVisited", error);
    return false;
  }
}
