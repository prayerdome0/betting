import type { NextConfig } from "next";
const emulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true";
const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["*.e2b.app", "127.0.0.1", "localhost"],
  async rewrites() {
    // Same-origin browser SDK traffic, only enabled explicitly for the local demo project.
    return emulators
      ? [
          {
            source: "/identitytoolkit.googleapis.com/:path*",
            destination:
              "http://127.0.0.1:9099/identitytoolkit.googleapis.com/:path*",
          },
          {
            source: "/securetoken.googleapis.com/:path*",
            destination:
              "http://127.0.0.1:9099/securetoken.googleapis.com/:path*",
          },
          {
            source: "/emulator/:path*",
            destination: "http://127.0.0.1:9099/emulator/:path*",
          },
          {
            source: "/google.firestore.v1.Firestore/:path*",
            destination:
              "http://127.0.0.1:8080/google.firestore.v1.Firestore/:path*",
          },
        ]
      : [];
  },
};
export default nextConfig;
