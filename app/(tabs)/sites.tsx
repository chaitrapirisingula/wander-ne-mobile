import { onValue, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { db } from "../../firebase";

export default function SitesScreen() {
  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    const sitesRef = ref(db, "2025_sites");
    const unsubscribe = onValue(sitesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sitesArray = Object.entries(data as any).map(
          ([id, value]: any) => ({
            id,
            ...value,
          })
        );
        setSites(sitesArray);
      } else {
        setSites([]);
      }
    });

    // Cleanup listener when component unmounts
    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sites</Text>
      <FlatList
        data={sites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.city}>{item.city}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 50 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  card: {
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: "#f2f2f2",
  },
  name: { fontSize: 18, fontWeight: "600" },
  city: { fontSize: 14, color: "#555" },
});
