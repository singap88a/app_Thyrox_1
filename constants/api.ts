// Backend API configuration for the Syrux mobile app

// ─── DEVELOPMENT ───────────────────────────────────────
// Android emulator: use 10.0.2.2 (maps to host localhost)
// iOS simulator / Expo Go on real device: use your machine's LAN IP
// Example: "http://192.168.1.100:5127"

export const API_BASE_URL = "http://192.168.1.6:5153"; // Points to the backend running on your PC

export const ENDPOINTS = {
  patientLookup: (id: number | string) =>
    `${API_BASE_URL}/api/Mobile/PatientLookup/${id}`,
};
