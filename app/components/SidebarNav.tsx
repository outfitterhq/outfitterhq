const linkStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 10px",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
};

function Item({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} style={linkStyle}>
      {label}
    </a>
  );
}

export default function SidebarNav() {
  return (
    <nav style={{ display: "grid", gap: 6 }}>
      <Item href="/dashboard" label="Dashboard" />
      <Item href="/guides" label="Guides" />
      <Item href="/clients" label="Clients" />
      <Item href="/guide-portal-access" label="Guide Portal Access" />
      <Item href="/private-land-tags" label="Tags for Sale" />
      <Item href="/draw-results" label="Draw Results" />
      <Item href="/payments" label="Payments" />
      <Item href="/pricing" label="Pricing" />
      <Item href="/documents" label="Documents" />
      <Item href="/permits" label="Permits" />
      <Item href="/calendar" label="Hunt Calendar" />
      <Item href="/settings" label="Settings" />
    </nav>
  );
}
