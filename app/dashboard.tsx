import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../constants/api";
import Thyroid3DViewer from "../components/Thyroid3DViewer";
import * as signalR from "@microsoft/signalr";
import axios from "axios";
import { useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

interface TestDto {
  testId: number;
  imagePath?: string;
  createdAt: string;
  diagnosisResult?: string;
  confidence?: number;
  classification?: string;
  bethesdaLabel?: string;
  nextStep?: string;

  // Lab Data
  tsh?: number;
  t3?: number;
  tt4?: number;
  fti?: number;
  t4U?: number;

  // Clinical
  nodulePresent?: boolean;
  onThyroxine?: number;
  thyroidSurgery?: number;
  queryHyperthyroid?: number;

  // AI Extra
  tiradsStage?: string;
  clinicalRecommendation?: string;
  riskLevel?: string;
  overlayImageUrl?: string;
  maskImageUrl?: string;
  roiImageUrl?: string;
  ataLevel?: string;
  needsManualReview?: boolean;
  consensus?: string;
}

interface PatientData {
  patientID: number;
  fullName: string;
  age: number;
  genderLabel: string;
  phoneNumber: string;
  address?: string;
  registrationAt: string;
  doctorID?: number;
  height: number;
  weight: number;
  bmi?: number;
  medicalHistory: string;
  currentMedications: string;
  knownAllergies: string;
  tests: TestDto[];
  latestDiagnosisResult?: string;
  latestConfidence?: number;
  latestClassification?: string;
  latestNextStep?: string;
}

// ── Helpers ────────────────────────────────────────────
const formatDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
};

const getClassificationStyle = (cls?: string) => {
  if (!cls) return { bg: "#1e2d4a", text: "#9ca3af", label: "Pending" };
  const l = cls.toLowerCase();
  if (l.includes("malignant"))    return { bg: "#3b0d0d", text: "#f87171", label: "Malignant" };
  if (l.includes("benign"))       return { bg: "#0d2e3b", text: "#38bdf8", label: "Benign" };
  if (l.includes("normal"))       return { bg: "#0d2e1a", text: "#4ade80", label: "Normal" };
  return { bg: "#1e2d4a", text: "#a5b4fc", label: cls };
};

const getConfidenceColor = (c?: number) => {
  if (!c) return "#6b7280";
  const pct = c <= 1 ? c * 100 : c;
  if (pct >= 80) return "#4ade80";
  if (pct >= 55) return "#facc15";
  return "#f87171";
};

const formatConfidence = (c?: number) => {
  if (!c) return "—";
  const pct = c <= 1 ? c * 100 : c;
  return `${pct.toFixed(1)}%`;
};

const getValidUri = (path?: string) => {
  if (!path) return '';
  let p = path.replace(/\\/g, '/');
  if (p.startsWith('/')) p = p.substring(1);
  return p.startsWith('http') ? p : `${API_BASE_URL}/${p}`;
};

// ── Info Row ───────────────────────────────────────────
const InfoRow = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) => (
  <View className="flex-row items-center justify-between py-4 border-b border-[#1a2540]">
    <Text className="text-[#6b7280] text-[12px] font-bold uppercase tracking-widest flex-1">
      {label}
    </Text>
    <Text
      className={`text-[14px] font-bold flex-1 text-right ${
        accent ? "text-[#00d4ff]" : "text-white"
      }`}
    >
      {value || "—"}
    </Text>
  </View>
);

// ── Section Card ───────────────────────────────────────
const SectionCard = ({
  title,
  children,
  accentColor = "#00d4ff",
}: {
  title: string;
  children: React.ReactNode;
  accentColor?: string;
}) => (
  <View className="bg-[#111827] rounded-[24px] p-6 mb-5 border border-[#1e2d4a]">
    <View className="flex-row items-center mb-5">
      <View
        style={{ backgroundColor: accentColor, width: 4, height: 18, borderRadius: 2, marginRight: 10 }}
      />
      <Text className="text-white text-[15px] font-black uppercase tracking-widest">
        {title}
      </Text>
    </View>
    {children}
  </View>
);

// ── Tab Bar ────────────────────────────────────────────
const TABS = [
  { id: "info",    label: "Info" },
  { id: "results", label: "Diagnosis" },
  { id: "anatomy", label: "3D Map" },
  { id: "history", label: "History" },
];

// ══════════════════════════════════════════════════════
export default function DashboardScreen() {
  const router = useRouter();
  const { patientData: patientDataStr } = useLocalSearchParams<{ patientData: string }>();
  const [activeTab, setActiveTab] = useState<"info" | "results" | "anatomy" | "history">("info");
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  let patient: PatientData | null = null;
  try {
    patient = JSON.parse(patientDataStr ?? "null");
  } catch {
    patient = null;
  }

  const myId = patient?.patientID?.toString();

  const fetchUnreadCount = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/Chat/UnreadCount/${myId}`);
      setUnreadCount(res.data);
    } catch (err) {
      console.error("Failed to fetch unread count", err);
    }
  }, [myId]);

  useEffect(() => {
    if (myId) {
      fetchUnreadCount();
      
      const hubUrl = `${API_BASE_URL}/chatHub`;
      const newConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${hubUrl}?userId=${myId}`, {
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect()
        .build();

      newConnection.on("ReceiveMessage", (message) => {
        if (message.receiverId === myId) {
          setUnreadCount(prev => prev + 1);
        }
      });

      newConnection.start()
        .then(() => setConnection(newConnection))
        .catch(err => console.error("SignalR Dashboard Error", err));

      return () => {
        newConnection.stop();
      };
    }
  }, [myId]);

  if (!patient) {
    return (
      <View className="flex-1 bg-[#0a0f1e] items-center justify-center px-8">
        <Text className="text-[#ef4444] text-lg font-bold text-center mb-6">
          Could not load patient data.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#00d4ff] rounded-2xl px-8 py-4"
        >
          <Text className="text-[#0a0f1e] font-black uppercase tracking-widest text-[12px]">
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const clsStyle = getClassificationStyle(patient.latestClassification);
  const initials = patient.fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // ── Render Tabs ──────────────────────────────────────
  const renderContent = () => {
    // ── INFO ─────────────────────────────────────────
    if (activeTab === "info") {
      return (
        <>
          <SectionCard title="Personal Information">
            <InfoRow label="Full Name"   value={patient!.fullName}     accent />
            <InfoRow label="Age"         value={`${patient!.age} years`} />
            <InfoRow label="Gender"      value={patient!.genderLabel}  />
            <InfoRow label="Phone"       value={patient!.phoneNumber}  />
            <InfoRow label="Address"     value={patient!.address ?? "—"} />
            <InfoRow label="Registered"  value={formatDate(patient!.registrationAt)} />
          </SectionCard>

          <SectionCard title="Physical Stats" accentColor="#a78bfa">
            <View className="flex-row gap-4">
              {[
                { label: "Height", value: patient!.height ? `${patient!.height} cm` : "—" },
                { label: "Weight", value: patient!.weight ? `${patient!.weight} kg` : "—" },
                { label: "BMI",    value: patient!.bmi ? String(patient!.bmi) : "—" },
              ].map((item) => (
                <View
                  key={item.label}
                  className="flex-1 bg-[#0d1520] rounded-2xl p-5 items-center border border-[#1e2d4a]"
                >
                  <Text className="text-[#6b7280] text-[10px] font-black uppercase tracking-widest mb-2">
                    {item.label}
                  </Text>
                  <Text className="text-white text-[20px] font-black">{item.value}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Medical History" accentColor="#fb923c">
            <Text className="text-[#d1d5db] text-[14px] leading-relaxed mb-5">
              {patient!.medicalHistory || "No medical history recorded."}
            </Text>
            <View className="h-px bg-[#1e2d4a] my-1" />
            <Text className="text-[#6b7280] text-[11px] font-black uppercase tracking-widest my-3">
              Current Medications
            </Text>
            <Text className="text-[#d1d5db] text-[14px] leading-relaxed mb-5">
              {patient!.currentMedications || "None recorded."}
            </Text>
            <View className="h-px bg-[#1e2d4a] my-1" />
            <Text className="text-[#6b7280] text-[11px] font-black uppercase tracking-widest my-3">
              Known Allergies
            </Text>
            <Text className="text-[#d1d5db] text-[14px] leading-relaxed">
              {patient!.knownAllergies || "None recorded."}
            </Text>
          </SectionCard>
        </>
      );
    }

    // ── RESULTS ───────────────────────────────────────
    if (activeTab === "results") {
      const tests = patient!.tests || [];
      const selectedTest = tests.find(t => t.testId === selectedTestId) || tests[0];

      const overlayImages = selectedTest?.overlayImageUrl ? selectedTest.overlayImageUrl.split(',').filter(Boolean) : [];
      const maskImages = selectedTest?.maskImageUrl ? selectedTest.maskImageUrl.split(',').filter(Boolean) : [];
      const roiImages = selectedTest?.roiImageUrl ? selectedTest.roiImageUrl.split(',').filter(Boolean) : [];
      const numImages = Math.max(overlayImages.length, maskImages.length, roiImages.length);

      return (
        <>
          <View className="mb-6">
            <Text className="text-[#6b7280] text-[13px] font-bold">
              Test Date: {selectedTest ? formatDate(selectedTest.createdAt) : 'N/A'}
            </Text>
          </View>

          {/* AI Vision Scans - Supports Multiple Images */}
          {numImages > 0 && Array.from({ length: numImages }).map((_, idx) => (
            <SectionCard key={`scan-${idx}`} title={`AI Vision Scan ${numImages > 1 ? idx + 1 : ''}`} accentColor="#0ea5e9">
              {/* Detection (Overlay) */}
              {overlayImages[idx] && (
                <View className="mb-5">
                  <View className="flex-row justify-between items-center px-1 mb-2">
                    <Text className="text-[#6b7280] text-[11px] font-black uppercase tracking-widest">Detection</Text>
                  </View>
                  <View className="overflow-hidden rounded-2xl border border-[#1e2d4a] bg-[#0d1520]">
                    <Image 
                      source={{ uri: getValidUri(overlayImages[idx].trim()) }} 
                      style={{ width: '100%', height: 220 }}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              )}

              {/* Segmentation (Mask) */}
              {maskImages[idx] && (
                <View className="mb-5">
                  <View className="flex-row justify-between items-center px-1 mb-2">
                    <Text className="text-[#6b7280] text-[11px] font-black uppercase tracking-widest">Segmentation</Text>
                  </View>
                  <View className="overflow-hidden rounded-2xl border border-[#1e2d4a] bg-[#0d1520]">
                    <Image 
                      source={{ uri: getValidUri(maskImages[idx].trim()) }} 
                      style={{ width: '100%', height: 220 }}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              )}

              {/* ROI Area */}
              {roiImages[idx] && (
                <View className="mb-2">
                  <View className="flex-row justify-between items-center px-1 mb-2">
                    <Text className="text-[#6b7280] text-[11px] font-black uppercase tracking-widest">ROI Area</Text>
                  </View>
                  <View className="overflow-hidden rounded-2xl border border-[#1e2d4a] bg-[#0d1520]">
                    <Image 
                      source={{ uri: getValidUri(roiImages[idx].trim()) }} 
                      style={{ width: '100%', height: 220 }}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              )}
            </SectionCard>
          ))}

          {/* Detailed AI Assessment */}
          {selectedTest && (
            <SectionCard title="Comprehensive AI Assessment" accentColor="#a78bfa">
              <View className="bg-[#111827] p-5 rounded-2xl border border-[#1e2d4a] gap-4">
                
                {/* Status & Risk */}
                <View className="flex-row justify-between border-b border-[#1e2d4a] pb-3 gap-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-[#6b7280] text-[9px] font-bold uppercase tracking-widest">Diagnosis</Text>
                    <Text className="text-white text-[14px] font-black mt-1 capitalize" numberOfLines={2}>{selectedTest.diagnosisResult || 'N/A'}</Text>
                  </View>
                  <View className="flex-1 items-end pl-2">
                    <Text className="text-[#6b7280] text-[9px] font-bold uppercase tracking-widest">Risk Level</Text>
                    <Text className="text-[#ef4444] text-[14px] font-black mt-1 capitalize">{selectedTest.riskLevel || 'N/A'}</Text>
                  </View>
                </View>

                {/* TIRADS, Bethesda & ATA */}
                <View className="flex-row justify-between border-b border-[#1e2d4a] pb-3 gap-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-[#6b7280] text-[9px] font-bold uppercase tracking-widest">TIRADS Stage</Text>
                    <Text className="text-[#f472b6] text-[12px] font-bold mt-1" numberOfLines={2}>{selectedTest.tiradsStage || 'N/A'}</Text>
                  </View>
                  <View className="flex-1 px-2 border-x border-[#1e2d4a]">
                    <Text className="text-[#6b7280] text-[9px] font-bold uppercase tracking-widest">ATA Level</Text>
                    <Text className="text-[#38bdf8] text-[12px] font-bold mt-1 text-center" numberOfLines={2}>{selectedTest.ataLevel || 'N/A'}</Text>
                  </View>
                  <View className="flex-1 items-end pl-2">
                    <Text className="text-[#6b7280] text-[9px] font-bold uppercase tracking-widest">Bethesda</Text>
                    <Text className="text-[#a78bfa] text-[12px] font-bold mt-1 text-right" numberOfLines={2}>{selectedTest.bethesdaLabel || 'N/A'}</Text>
                  </View>
                </View>

                {selectedTest.needsManualReview && (
                  <View className="bg-[#451a03] p-3 rounded-lg mt-2 border border-[#78350f]">
                     <Text className="text-[#fbbf24] text-[11px] font-bold text-center">⚠️ MANUAL REVIEW NEEDED</Text>
                  </View>
                )}

                {/* Clinical Recommendation */}
                <View>
                  <Text className="text-[#00d4ff] text-[10px] font-black uppercase tracking-widest mb-2">Clinical Recommendation</Text>
                  <Text className="text-[#d1d5db] text-[13px] leading-5">
                    {selectedTest.clinicalRecommendation || 'No recommendation available.'}
                  </Text>
                </View>
              </View>
            </SectionCard>
          )}

          {/* Lab Markers */}
          {selectedTest && (
            <SectionCard title="Laboratory Biomarkers" accentColor="#34d399">
              <View className="bg-[#111827] rounded-2xl border border-[#1e2d4a] overflow-hidden">
                <View className="flex-row justify-between p-4 border-b border-[#1e2d4a] bg-[#0d1520]">
                  <Text className="text-[#6b7280] text-[11px] font-black uppercase tracking-wider w-1/3">Biomarker</Text>
                  <Text className="text-[#6b7280] text-[11px] font-black uppercase tracking-wider text-right w-1/3">Value</Text>
                  <Text className="text-[#6b7280] text-[11px] font-black uppercase tracking-wider text-right w-1/3">Ref Range</Text>
                </View>
                {[
                  { key: 'TSH', val: selectedTest.tsh, unit: 'mIU/L', ref: '0.4 - 4.0' },
                  { key: 'T3', val: selectedTest.t3, unit: 'ng/dL', ref: '80 - 200' },
                  { key: 'Total T4', val: selectedTest.tt4, unit: 'μg/dL', ref: '4.5 - 11.2' },
                  { key: 'FTI', val: selectedTest.fti, unit: '', ref: '1.2 - 4.9' },
                  { key: 'T4U', val: selectedTest.t4U, unit: '', ref: '0.8 - 1.3' }
                ].map((item, idx, arr) => (
                  <View 
                    key={idx} 
                    className={`flex-row justify-between p-4 items-center ${idx !== arr.length - 1 ? 'border-b border-[#1e2d4a]/50' : ''}`}
                  >
                    <Text className="text-white text-[13px] font-bold w-1/3">{item.key}</Text>
                    <View className="items-end w-1/3">
                      <Text className="text-[#00d4ff] text-[15px] font-black">{item.val || '—'}</Text>
                      {!!item.unit && <Text className="text-[#6b7280] text-[10px] font-bold">{item.unit}</Text>}
                    </View>
                    <Text className="text-[#9ca3af] text-[11px] font-semibold text-right w-1/3">{item.ref}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {!selectedTest && (
            <View className="bg-[#111827] rounded-[24px] p-10 border border-[#1e2d4a] items-center">
              <Text className="text-[#374151] text-[40px] mb-4">🔬</Text>
              <Text className="text-[#6b7280] text-[14px] font-bold text-center">
                No diagnosis results yet.{"\n"}Check back after your scan.
              </Text>
            </View>
          )}
        </>
      );
    }

    // ── 3D ANATOMY ────────────────────────────────────
    if (activeTab === "anatomy") {
      const tests = patient!.tests || [];
      const selectedTest = tests.find(t => t.testId === selectedTestId) || tests[0];

      return (
        <>
          <View className="mb-6">
            <Text className="text-[#6b7280] text-[13px] font-bold">
              Test Date: {selectedTest ? formatDate(selectedTest.createdAt) : 'N/A'}
            </Text>
          </View>
          <SectionCard title="3D Anatomical Analysis" accentColor="#f472b6">
            <Thyroid3DViewer diseaseType={selectedTest?.classification} />
          </SectionCard>
        </>
      );
    }

    // ── HISTORY ───────────────────────────────────────
    if (activeTab === "history") {
      const tests = patient!.tests ?? [];
      if (tests.length === 0) {
        return (
          <View className="bg-[#111827] rounded-[24px] p-10 border border-[#1e2d4a] items-center">
            <Text className="text-[#374151] text-[40px] mb-4">📋</Text>
            <Text className="text-[#6b7280] text-[14px] font-bold text-center">
              No test records found.
            </Text>
          </View>
        );
      }
      return (
        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
          <Text className="text-[#6b7280] text-[12px] font-bold uppercase tracking-widest mb-4">
            {tests.length} test{tests.length > 1 ? "s" : ""} recorded
          </Text>
          {tests.map((test, idx) => {
            const style = getClassificationStyle(test.classification);
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedTestId(test.testId);
                  setActiveTab("results");
                }}
                key={test.testId}
                className="bg-[#111827] rounded-[24px] p-6 mb-4 border border-[#1e2d4a]"
              >
                {/* Header row */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-9 h-9 bg-[#0d1520] rounded-xl items-center justify-center border border-[#1e2d4a]">
                      <Text className="text-[#00d4ff] text-[11px] font-black">#{idx + 1}</Text>
                    </View>
                    <View>
                      <Text className="text-white text-[13px] font-bold mb-1">
                        {formatDate(test.createdAt)}
                      </Text>
                      <Text className="text-[#6b7280] text-[11px] font-bold uppercase tracking-widest">
                        {test.diagnosisResult || 'Tested'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: style.bg }} className="px-3 py-1.5 rounded-xl flex-row items-center gap-2">
                    <Text style={{ color: style.text }} className="text-[11px] font-black uppercase tracking-wider">
                      {style.label}
                    </Text>
                    <Text className="text-white ml-2 text-[12px]">➔</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    }

    return null;
  };

  // ── Main Render ──────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#0a0f1e" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? 10 : 0 }}>
        {/* Top Bar */}
        <View className="flex-row items-center px-6 pt-4 pb-3">
          <TouchableOpacity
            onPress={() => router.replace("/")}
            className="w-10 h-10 rounded-2xl bg-[#111827] border border-[#1e2d4a] items-center justify-center mr-4"
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
          <Text className="text-white text-[16px] font-black uppercase tracking-widest flex-1">
            My Dashboard
          </Text>
          <TouchableOpacity 
            onPress={() => {
              setUnreadCount(0); // Clear badge when entering chat
              router.push({
                pathname: "/chat",
                params: { patientId: patient?.patientID, doctorId: patient?.doctorID || "1" }
              });
            }}
            className="w-10 h-10 rounded-2xl bg-[#111827] border border-[#1e2d4a] items-center justify-center mr-3"
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#00d4ff" />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute',
                top: -5,
                right: -5,
                backgroundColor: '#ef4444',
                borderRadius: 10,
                width: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#111827'
              }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text className="text-[#00d4ff] text-[12px] font-bold">Thyrax</Text>
        </View>

        {/* Patient Header Card */}
        <View className="mx-6 mb-4 bg-[#111827] rounded-[28px] p-6 border border-[#1e2d4a] flex-row items-center gap-4">
          {/* Avatar */}
          <View className="w-16 h-16 rounded-[18px] bg-[#00d4ff] items-center justify-center flex-shrink-0">
            <Text className="text-[#0a0f1e] text-[22px] font-black">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white text-[18px] font-black" numberOfLines={1}>
              {patient.fullName}
            </Text>
            <Text className="text-[#00d4ff] text-[12px] font-bold mt-0.5">
              Patient ID #{patient.patientID}
            </Text>
            <View className="flex-row items-center mt-2 gap-2">
              <View style={{ backgroundColor: clsStyle.bg }} className="px-2.5 py-1 rounded-lg">
                <Text style={{ color: clsStyle.text }} className="text-[10px] font-black uppercase tracking-wider">
                  {clsStyle.label}
                </Text>
              </View>
              <Text className="text-[#4b5563] text-[11px] font-medium">
                {patient.age}y · {patient.genderLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Bar */}
        <View className="mx-6 mb-4 bg-[#111827] rounded-2xl p-1 flex-row border border-[#1e2d4a]">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                activeTab === tab.id ? "bg-[#00d4ff]" : ""
              }`}
              activeOpacity={0.8}
            >
              <Text
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  activeTab === tab.id ? "text-[#0a0f1e]" : "text-[#6b7280]"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}
        >
          {renderContent()}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
