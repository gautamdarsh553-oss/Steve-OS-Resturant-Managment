import "./globals.css";

export const metadata = {
  title: "Steve OS — Restaurant Operating System",
  description: "Advanced Restaurant Management System powered by Voice Recognition & Stripe Payroll",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
