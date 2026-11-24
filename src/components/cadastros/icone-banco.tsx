import { Landmark } from "lucide-react";
import { cn } from "@/lib/cn";

/** Cores aproximadas de cada banco, pelo código (só para o ícone ficar reconhecível). */
const CORES: Record<string, string> = {
  "001": "#F8D117",
  "033": "#EC0000",
  "041": "#0B5CA8",
  "077": "#FF7A00",
  "104": "#005CA9",
  "208": "#0A2240",
  "212": "#00A651",
  "237": "#CC092F",
  "260": "#820AD1",
  "290": "#1BB99A",
  "323": "#00B1EA",
  "336": "#242424",
  "341": "#EC7000",
  "380": "#21C25E",
  "102": "#111111",
  "748": "#3FA110",
  "756": "#003641",
};

/** Bolinha com as iniciais do banco (ou um ícone de banco para "Outro"). */
export function IconeBanco({ codigo, nome, className }: { codigo: string | null; nome: string; className?: string }) {
  const cor = codigo ? CORES[codigo] : undefined;
  const iniciais = nome
    .replace(/^Banco (do |da )?/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      title={nome}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        cor ? "text-white" : "bg-verde-claro text-verde",
        codigo === "001" && "text-[#003399]",
        className,
      )}
      style={cor ? { backgroundColor: cor } : undefined}
    >
      {cor ? iniciais : <Landmark className="h-4 w-4" />}
    </span>
  );
}
