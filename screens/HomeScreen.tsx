import { onValue, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { rtdb } from "../firebase/config";

export default function HomeScreen() {
  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    const sitesRef = ref(rtdb, "2025_sites");
    const unsubscribe = onValue(sitesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formatted = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setSites(formatted);
      } else {
        setSites([]);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>
        WanderNebraska Sites
      </Text>

      <FlatList
        data={sites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 10,
              marginBottom: 10,
              backgroundColor: "#f3f3f3",
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              {item.name}
            </Text>
            <Text>
              {item.city}, {item.state}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
