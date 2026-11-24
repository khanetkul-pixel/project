// =====================================================
// layout.tsx — โครงหลักของทุกหน้า: ฟอนต์ + สไตล์ + ตัวเก็บข้อมูลที่ทุกหน้าใช้ร่วมกัน
//   AuthProvider  = ระบบเข้าสู่ระบบ (components/AuthProvider.tsx)
//   RatesProvider = อัตราค่าจอด (components/RatesProvider.tsx)
// =====================================================
import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { RatesProvider } from "@/components/RatesProvider";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

// ฟอนต์เดียวกับใน Figma
const plex = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Parking · ระบบลานจอดรถ",
  description: "ระบบบริหารจัดการลานจอดรถอัจฉริยะ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={plex.variable}>
      <body>
        <AuthProvider>
          <RatesProvider>{children}</RatesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
