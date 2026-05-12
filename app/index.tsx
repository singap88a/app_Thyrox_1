import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ENDPOINTS } from "../constants/api";
// ////
export default function HomeScreen() {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLookup = async () => {
    const id = patientId.trim();
    if (!id) {
      setError("Please enter your Patient ID.");
      shake();
      return;
    }
    if (isNaN(Number(id))) {
      setError("Patient ID must be a number.");
      shake();
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(ENDPOINTS.patientLookup(id), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();

      if (json.succeeded && json.data) {
        // Pass data via router params (stringified)
        router.push({
          pathname: "/dashboard",
          params: { patientData: JSON.stringify(json.data) },
        });
      } else {
        setError("Patient not found. Please check your ID and try again.");
        shake();
      }
    } catch (err) {
      setError("Connection error. Please check your internet and try again.");
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0f1e" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? 10 : 0 }}>
        {/* Background decoration circles */}
        <View className="absolute top-[-80px] right-[-60px] w-[280px] h-[280px] rounded-full bg-[#1a2a5e] opacity-40" />
        <View className="absolute bottom-[-100px] left-[-80px] w-[320px] h-[320px] rounded-full bg-[#0d1f45] opacity-50" />
        <View className="absolute top-[40%] left-[20%] w-[150px] h-[150px] rounded-full bg-[#00d4ff] opacity-5" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 justify-center px-8 py-16">
              {/* Brand Header */}
              <View className="items-center mb-14">
                {/* Logo mark */}
                <View className="w-20 h-20 rounded-[24px] bg-[#00d4ff] items-center justify-center mb-5 shadow-lg">
                  <View className="w-10 h-10 rounded-full bg-[#0a0f1e] items-center justify-center">
                    <View className="w-5 h-5 rounded-full bg-[#00d4ff]" />
                  </View>
                </View>

                <Text className="text-white text-[38px] font-bold tracking-widest mb-1">
                  SYRUX
                </Text>
                <Text className="text-[#00d4ff] text-[13px] font-medium tracking-[0.3em] uppercase">
                  Patient Portal
                </Text>

                <View className="w-16 h-[2px] bg-[#00d4ff] mt-5 opacity-40 rounded-full" />
              </View>

              {/* Card */}
              <View className="bg-[#111827] rounded-[28px] p-8 border border-[#1e2d4a] shadow-2xl">
                <Text className="text-white text-[22px] font-bold mb-2">
                  Access Your Results
                </Text>
                <Text className="text-[#6b7280] text-sm font-medium mb-8 leading-relaxed">
                  Enter the Patient ID shared by your doctor to view your complete medical dashboard.
                </Text>

                {/* Input */}
                <View className="mb-3">
                  <Text className="text-[#9ca3af] text-[11px] font-bold uppercase tracking-widest mb-2.5">
                    Patient ID
                  </Text>
                  <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                    <View
                      className={`flex-row items-center bg-[#0d1520] border-2 rounded-2xl px-5 py-4 ${
                        error ? "border-[#ef4444]" : "border-[#1e2d4a]"
                      }`}
                    >
                      <Text className="text-[#00d4ff] text-lg font-bold mr-2">#</Text>
                      <TextInput
                        className="flex-1 text-white text-[18px] font-semibold"
                        placeholder="e.g. 42"
                        placeholderTextColor="#374151"
                        value={patientId}
                        onChangeText={(t) => {
                          setPatientId(t);
                          if (error) setError("");
                        }}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={handleLookup}
                        autoFocus={false}
                        maxLength={10}
                      />
                    </View>
                  </Animated.View>
                  {error ? (
                    <Text className="text-[#ef4444] text-[12px] font-medium mt-2.5 ml-1">
                      {error}
                    </Text>
                  ) : null}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleLookup}
                  disabled={loading}
                  activeOpacity={0.85}
                  className="mt-6"
                >
                  <View
                    className={`rounded-2xl py-5 items-center ${
                      loading ? "bg-[#0097b3]" : "bg-[#00d4ff]"
                    }`}
                  >
                    {loading ? (
                      <View className="flex-row items-center gap-3">
                        <ActivityIndicator color="#0a0f1e" size="small" />
                        <Text className="text-[#0a0f1e] font-black text-[13px] uppercase tracking-widest ml-2">
                          Loading...
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-[#0a0f1e] font-black text-[13px] uppercase tracking-widest">
                        View My Dashboard →
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Footer hint */}
              <View className="items-center mt-10">
                <Text className="text-[#374151] text-[12px] text-center leading-relaxed font-medium">
                  Your Patient ID is provided by your doctor.{"\n"}
                  This app is read-only — your data is safe.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}