export default {
  expo: {
    name: "ConstLabour",
    slug: "constlabour",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
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
        projectId: "" // Will be set after running 'eas init'
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || `https://jkwrupxrjbrmuufxetlh.supabase.co`,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""
    }
  }
};
