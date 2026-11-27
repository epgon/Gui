"use client";

import {
  ArrowUpRight, BadgeDollarSign, Banknote, Bell, CalendarDays, ChartNoAxesCombined, ChevronRight, CircleCheckBig, Clock, CreditCard, FileInput, FolderOpen, FolderTree,
  HandCoins, History, LayoutDashboard, LockKeyhole, PiggyBank, ReceiptText, Scale, Search, Settings, SlidersHorizontal, Tags, ToggleRight, UserRound, Users, Wallet, BarChart3, FileText, type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { JanelaAjuda, SEM_RESULTADO } from "@/components/ajuda/central-ajuda";
import { useSistema } from "@/components/layout/provedor-sistema";
import { buscarArtigos } from "@/lib/ajuda/busca";
import { MODULOS_AJUDA, agruparArtigos, artigosDaTelaCatalogo, telaDoCaminho, type ModuloAjuda, type TelaCatalogo } from "@/lib/ajuda/catalogo";
import { ARTIGOS_DIVIDAS } from "@/lib/ajuda/dividas";
import type { ArtigoAjuda } from "@/lib/ajuda/tipos";
import { telasOcultas } from "@/lib/parametros/tipos";

type Navegacao = { nivel: "inicio" } | { nivel: "modulo"; modulo: string } | { nivel: "tela"; modulo: string; tela: string };

const ICONE_MODULO: Record<string, LucideIcon> = {
  geral: CircleCheckBig,
  financeiro: ReceiptText,
  gestao: ChartNoAxesCombined,
  relatorios: Search,
  cadastros: FolderOpen,
  administracao: LockKeyhole,
  configuracoes: Settings,
};

const ICONE_TELA: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/notificacoes": Bell,
  "/financeiro/lancamentos": BadgeDollarSign,
  "/financeiro/agenda": CalendarDays,
  "/financeiro/recorrentes": Clock,
  "/financeiro/importacoes": FileInput,
  "/gestao/orcamentos": PiggyBank,
  "/gestao/dividas": HandCoins,
  "/relatorios/fluxo-de-caixa": BarChart3,
  "/relatorios/saldo-detalhado": Scale,
  "/cadastros/contas-financeiras": Wallet,
  "/cadastros/cartoes-de-credito": CreditCard,
  "/cadastros/categorias": FolderTree,
  "/cadastros/clientes-e-fornecedores": Users,
  "/cadastros/formas-de-pagamento": Banknote,
  "/cadastros/tags": Tags,
  "/administracao/meus-dados": UserRound,
  "/administracao/auditoria": History,
  "/configuracoes/parametros": SlidersHorizontal,
  "/configuracoes/recursos": ToggleRight,
};

function iconeDaTela(href: string): LucideIcon {
  return ICONE_TELA[href] ?? (href.startsWith("/gestao/dividas") ? HandCoins : FileText);
}

function BotaoArtigo({ titulo, aoClicar }: { titulo: string; aoClicar: () => void }) {
  return (
    <button type="button" onClick={aoClicar} className="group flex w-full items-start gap-1.5 py-1 text-left text-sm text-verde">
      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-verde" aria-hidden="true" />
      <span className="group-hover:underline">{titulo}</span>
    </button>
  );
}

function Trilha({ itens }: { itens: { rotulo: string; aoClicar?: () => void }[] }) {
  return (
    <nav aria-label="Onde você está" className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
      {itens.map((t, i) => (
        <Fragment key={`${i}-${t.rotulo}`}>
          {t.aoClicar ? (
            <button type="button" onClick={t.aoClicar} className="text-left font-semibold text-gray-700 hover:text-verde hover:underline">
              {t.rotulo}
            </button>
          ) : (
            <span className="text-gray-500">{t.rotulo}</span>
          )}
          {i < itens.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />}
        </Fragment>
      ))}
    </nav>
  );
}

/** Módulos e telas sem as telas dos recursos desligados; módulos que ficam vazios saem. */
function modulosVisiveis(ocultas: string[]): ModuloAjuda[] {
  return MODULOS_AJUDA.map((m) => ({ ...m, telas: m.telas.filter((t) => !ocultas.includes(t.href)) })).filter((m) => m.telas.length > 0);
}

function inicial(caminho: string, modulos: ModuloAjuda[]): Navegacao {
  const achada = telaDoCaminho(caminho, modulos);
  return achada ? { nivel: "tela", modulo: achada.modulo.id, tela: achada.tela.id } : { nivel: "inicio" };
}

/**
 * Conteúdo da "Central de Ajuda" no painel lateral: título, busca, trilha clicável
 * (Início > Módulo > Tela > Artigos) e só os artigos da tela escolhida. Começa na tela atual.
 */
export function CentralAjudaPainel() {
  const caminho = usePathname();
  const { recursos } = useSistema();
  const modulos = useMemo(() => modulosVisiveis(telasOcultas(recursos)), [recursos]);
  const [nav, setNav] = useState<Navegacao>(() => inicial(caminho, modulos));
  const [caminhoVisto, setCaminhoVisto] = useState(caminho);
  const [busca, setBusca] = useState("");
  const [janela, setJanela] = useState<{ artigo?: string } | null>(null);

  // Ao trocar de tela, volta para os artigos da nova tela (ajuste durante a renderização, sem efeito).
  if (caminho !== caminhoVisto) {
    setCaminhoVisto(caminho);
    setNav(inicial(caminho, modulos));
  }

  const termo = busca.trim();
  const resultados = useMemo(() => (termo ? buscarArtigos(ARTIGOS_DIVIDAS, termo) : []), [termo]);
  const modulo = nav.nivel === "inicio" ? undefined : modulos.find((m) => m.id === nav.modulo);
  const tela: TelaCatalogo | undefined = nav.nivel === "tela" ? modulo?.telas.find((t) => t.id === nav.tela) : undefined;
  const artigosDaTela = tela ? artigosDaTelaCatalogo(tela) : [];
  const { principais, grupos } = agruparArtigos(artigosDaTela);

  const irInicio = () => setNav({ nivel: "inicio" });
  const irModulo = (id: string) => setNav({ nivel: "modulo", modulo: id });
  const abrir = (a: ArtigoAjuda) => <BotaoArtigo key={a.id} titulo={a.titulo} aoClicar={() => setJanela({ artigo: a.id })} />;

  let trilha: { rotulo: string; aoClicar?: () => void }[];
  if (!modulo) trilha = [{ rotulo: "Início" }, { rotulo: "Qual módulo?" }];
  else if (!tela) trilha = [{ rotulo: "Início", aoClicar: irInicio }, { rotulo: modulo.rotulo, aoClicar: () => irModulo(modulo.id) }, { rotulo: "Qual tela?" }];
  else trilha = [{ rotulo: "Início", aoClicar: irInicio }, { rotulo: modulo.rotulo, aoClicar: () => irModulo(modulo.id) }, { rotulo: tela.rotulo, aoClicar: () => setNav({ nivel: "tela", modulo: modulo.id, tela: tela.id }) }, { rotulo: "Artigos" }];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg text-gray-800">Central de Ajuda</h2>
        <p className="text-base text-verde">Como podemos ajudá-lo?</p>
      </div>
      <label className="flex h-9 items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm text-gray-700 focus-within:border-verde">
        <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite ou navegue" aria-label="Buscar artigos" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
      </label>

      {termo ? (
        <>
          <Trilha itens={[{ rotulo: "Início" }, { rotulo: "Resultados da busca" }]} />
          <div className="rounded-lg border border-borda bg-white p-3 shadow-cartao">
            {resultados.length ? <div aria-label="Resultados da busca">{resultados.map(abrir)}</div> : <p className="py-2 text-sm text-gray-500">{SEM_RESULTADO}</p>}
          </div>
        </>
      ) : (
        <>
          <Trilha itens={trilha} />
          {!modulo && (
            <div className="grid grid-cols-2 gap-2">
              {modulos.map((m) => {
                const Icone = ICONE_MODULO[m.id] ?? FolderOpen;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => irModulo(m.id)}
                    className="flex min-w-0 items-center gap-1.5 rounded-lg border border-borda bg-white px-2 py-3 text-left text-[13px] text-gray-700 shadow-cartao hover:border-verde"
                  >
                    <Icone className="h-4 w-4 shrink-0 text-verde" aria-hidden="true" />
                    <span className="min-w-0 break-words">{m.rotulo}</span>
                  </button>
                );
              })}
            </div>
          )}
          {modulo && !tela && (
            <div className="space-y-2">
              {modulo.telas.map((t) => {
                const Icone = iconeDaTela(t.href);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNav({ nivel: "tela", modulo: modulo.id, tela: t.id })}
                    className="flex w-full items-center gap-2 rounded-lg border border-borda bg-white px-3 py-3 text-left text-sm text-gray-700 shadow-cartao hover:border-verde"
                  >
                    <Icone className="h-5 w-5 shrink-0 text-verde" aria-hidden="true" />
                    <span className="flex-1">{t.rotulo}</span>
                    <span className="text-xs italic text-gray-500">{artigosDaTelaCatalogo(t).length}</span>
                  </button>
                );
              })}
            </div>
          )}
          {tela && (
            <div className="rounded-lg border border-borda bg-white p-3 shadow-cartao">
              {(() => {
                const Icone = iconeDaTela(tela.href);
                return <Icone className="float-right ml-2 h-5 w-5 text-verde" aria-hidden="true" />;
              })()}
              {artigosDaTela.length ? (
                <>
                  <div>{principais.map(abrir)}</div>
                  {grupos.map((g) => (
                    <section key={g.rotulo}>
                      <h3 className={"mt-3 text-xs font-medium text-gray-500"}>{g.rotulo}</h3>
                      <div className="pl-4">{g.artigos.map(abrir)}</div>
                    </section>
                  ))}
                </>
              ) : (
                <p className="text-sm text-gray-500">Os artigos desta tela ainda estão sendo escritos.</p>
              )}
            </div>
          )}
        </>
      )}
      <JanelaAjuda tela={tela?.tela ?? "visao"} artigoInicial={janela?.artigo} aberto={janela !== null} aoFechar={() => setJanela(null)} />
    </div>
  );
}
