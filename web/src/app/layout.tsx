import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rivio Flow · Espaço do médico",
  description: "Contexto, evidências e acompanhamento autorizado de pacientes no Rivio Flow.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#main">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
