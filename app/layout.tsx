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
      <head>
        {/* Script to catch password reset tokens before React loads */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Check for PKCE code parameter first - if present, redirect to callback route
                var urlParams = new URLSearchParams(window.location.search);
                var code = urlParams.get("code");
                if (code) {
                  window.location.replace("/auth/callback?code=" + encodeURIComponent(code) + "&type=recovery&next=/reset-password");
                  return;
                }
                
                // Check URL hash for recovery token
                if (window.location.hash) {
                  var hash = window.location.hash.substring(1);
                  var hashParams = new URLSearchParams(hash);
                  var type = hashParams.get("type");
                  if (type === "recovery") {
                    window.location.replace("/reset-password" + window.location.hash);
                    return;
                  }
                }
                
                // Check query params for recovery token (non-PKCE flow)
                var type = urlParams.get("type");
                if (type === "recovery") {
                  var accessToken = urlParams.get("access_token");
                  var refreshToken = urlParams.get("refresh_token");
                  if (accessToken && refreshToken) {
                    window.location.replace("/reset-password#access_token=" + accessToken + "&refresh_token=" + refreshToken + "&type=recovery");
                    return;
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body style={{ fontFamily: "system-ui", margin: 0 }}>
        <div className="root-banner" style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: 14 }}>
          <b>HuntCo</b> — Admin HQ
        </div>
        {children}
      </body>
    </html>
  );
}
