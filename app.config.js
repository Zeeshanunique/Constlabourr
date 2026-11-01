module.exports = {
  expo: {
    name: "ConstLabour",
    slug: "constlabour",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/icon.png",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#0F172A",
      image: "./assets/splash.png"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.constlabour.app",
      icon: "./assets/icon.png"
    },
    android: {
      versionCode: 2,
      permissions: [
        "USE_BIOMETRIC",
        "USE_FINGERPRINT"
      ],
      icon: "./assets/android-icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#0F172A"
      },
      package: "com.constlabour.app"
    },
    scheme: "constlabour",
    plugins: [
      "@react-native-community/datetimepicker",
      "expo-font",
      "expo-secure-store",
      "expo-local-authentication"
    ],
    extra: {
      eas: {
        projectId: "54a94cb7-9f7a-498b-92bc-cc4c112a6345"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || `https://jkwrupxrjbrmuufxetlh.supabase.co`,
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprd3J1cHhyamJybXV1ZnhldGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MTc1NDMsImV4cCI6MjA5MzE5MzU0M30.iRwt4RHTIkUfK7C_a-yOtByCqJtI9vEH2VsC-LTB4x8"
    }
  }
};
