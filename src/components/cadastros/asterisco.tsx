/** Asterisco laranja dos itens que já vêm com o sistema. */
export function AsteriscoPadrao({ mostrar }: { mostrar: boolean }) {
  if (!mostrar) return null;
  return (
    <span className="ml-1 font-bold text-despesa" title="Cadastro padrão do sistema">
      *
    </span>
  );
}
