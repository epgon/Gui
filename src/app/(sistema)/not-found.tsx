import { EstadoVazio } from "@/components/ui/estado-vazio";

export default function NaoEncontrada() {
  return (
    <main className="flex-1 p-6">
      <EstadoVazio titulo="Página não encontrada" texto="O endereço digitado não existe." acao={{ rotulo: "Ir para a Visão Geral", href: "/" }} />
    </main>
  );
}
