import AsyncStorage from "@react-native-async-storage/async-storage";

export interface VisitedSite {
  id: string;
  name: string;
  city?: string;
  state?: string;
  image?: string;
  visitedAt: string;
}

const STORAGE_KEY = "visitedSites";

export async function getVisitedSites(): Promise<VisitedSite[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VisitedSite[];
  } catch (error) {
    console.error("Failed to load visited sites:", error);
    return [];
  }
}

export async function addVisitedSite(site: Omit<VisitedSite, "visitedAt">) {
  try {
    const existing = await getVisitedSites();
    const updatedAt = new Date().toISOString();

    const filtered = existing.filter((entry) => entry.id !== site.id);
    const next: VisitedSite = { ...site, visitedAt: updatedAt };

    const newList = [next, ...filtered];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
  } catch (error) {
    console.error("Failed to save visited site:", error);
  }
}

export async function clearVisitedSites() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear visited sites:", error);
  }
}

