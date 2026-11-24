import Image from "next/image";
import Link from "next/link";

/** Tela vazia com o mascote Gui e um botão que leva ao lugar certo. */
export function EstadoVazio({ titulo, texto, acao }: {
  titulo: string;
  texto?: React.ReactNode;
  acao?: { rotulo: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Image src="/gui-mascote.jpg" alt="Mascote Gui" width={300} height={164} className="h-auto w-56 mix-blend-multiply" />
      <h2 className="mt-2 text-lg font-semibold text-gray-800">{titulo}</h2>
      {texto && <p className="mt-1 max-w-md text-sm text-gray-500">{texto}</p>}
      {acao && (
        <Link href={acao.href} className="mt-4 inline-flex h-9 items-center rounded-md bg-verde px-4 text-sm font-semibold text-white hover:bg-verde-escuro">
          {acao.rotulo}
        </Link>
      )}
    </div>
  );
}
