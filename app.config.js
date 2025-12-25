export default {
  expo: {
    name: "ConstLabour",
    slug: "constlabour",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    owner: "zeeshanunique",
    icon: "./assets/icon.png",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#2563eb",
      image: "./assets/splash.png"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.constlabour.app",
      icon: "./assets/icon.png"
    },
    android: {
      icon: "./assets/android-icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#2563eb"
      },
      package: "com.constlabour.app"
    },
    scheme: "constlabour",
    extra: {
      eas: {
        projectId: "8b2048c3-7b22-4df8-a1b9-fe4d1f88fce8"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || `https://quoxzaznmrtkshvrxgrl.supabase.co`,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1b3h6YXpubXJ0a3NodnJ4Z3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDUzMzEsImV4cCI6MjA4MTE4MTMzMX0._I38LT6c1a7iu7CXE73Z_vATObmaRqVMl2lhrWByBo4"
    }
  }
};
