// Admin portal layout — completely isolated from public/buyer/seller layouts.
// No header, no footer, no links to public site. Intentionally minimal.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
