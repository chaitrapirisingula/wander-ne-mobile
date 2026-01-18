import { ref, set, get, remove } from "firebase/database";
import { db } from "../firebase";

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
    console.error("Failed to load visited sites:", error);
    return [];
  }
}

export async function addVisitedSite(userId: string, site: Omit<VisitedSite, "visitedAt">) {
  try {
    const visitedAt = new Date().toISOString();
    const visitedSite: VisitedSite = { ...site, visitedAt };
    
    const visitedRef = ref(db, `userVisitedSites/${userId}/${site.id}`);
    await set(visitedRef, visitedSite);
  } catch (error) {
    console.error("Failed to save visited site:", error);
    throw error;
  }
}

export async function clearVisitedSites(userId: string) {
  try {
    const visitedRef = ref(db, `userVisitedSites/${userId}`);
    await remove(visitedRef);
  } catch (error) {
    console.error("Failed to clear visited sites:", error);
    throw error;
  }
}

export async function isSiteVisited(userId: string, siteId: string): Promise<boolean> {
  try {
    const visitedRef = ref(db, `userVisitedSites/${userId}/${siteId}`);
    const snapshot = await get(visitedRef);
    return snapshot.exists();
  } catch (error) {
    console.error("Failed to check if site is visited:", error);
    return false;
  }
}
