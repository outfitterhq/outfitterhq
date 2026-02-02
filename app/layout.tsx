import "./globals.css";

export const metadata = {
  title: "HuntCo Admin HQ",
  description: "Outfitter and client portal",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 0 }}>
        <div className="root-banner" style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: 14 }}>
          <b>HuntCo</b> — Admin HQ
        </div>
        {children}
      </body>
    </html>
  );
}
