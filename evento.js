// ═══════════════════════════════════════════════════════
// Dentro de um contrato — cabeçalho, abas e painel
// ═══════════════════════════════════════════════════════

import { buscarEvento, listarItens, minhaPermissao, listarReceitas, listarClassificacao, listarLancamentos, encerrarEvento, apagarEvento } from './nucleo.js';
import { esc, aviso, moeda, numero, periodo, dataBR, iniciais, SITUACAO_EVENTO, registrarView } from './ui.js';
import { abaClassificacao } from './classificacao.js';
import { abaReceitas } from './receitas.js';

export const contexto = { evento: null, permissao: null, itens: [], aba: 'painel' };

const ABAS = [
  { id: 'painel',       rotulo: 'Painel' },
  { id: 'classificacao', rotulo: 'Classificação' },
  { id: 'receitas',     rotulo: 'Repasses',   perm: 'ver_receitas' },
  { id: 'prestacao',    rotulo: 'Prestação de contas' },
];

function abasVisiveis() {
  const p = contexto.permissao || {};
  return ABAS.filter(a => !a.perm || p.admin || p[a.perm]);
}

export async function telaEvento(eventoId, aba = 'painel') {
  const alvo = document.querySelector('#conteudo');
  alvo.innerHTML = `<div style="padding:40px;text-align:center;color:var(--texto-2)">Abrindo contrato...</div>`;

  try {
    const [ev, perm] = await Promise.all([buscarEvento(eventoId), minhaPermissao(eventoId)]);
    contexto.evento = ev;
    contexto.permissao = perm;
    contexto.itens = await listarItens(eventoId);
  } catch (e) {
    alvo.innerHTML = `<div class="vazio"><h3>Não consegui abrir</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  contexto.aba = aba;
  desenhar();
}

export function recarregarAba() { desenhar(); }

export async function recarregarItens() {
  contexto.itens = await listarItens(contexto.evento.id);
  desenhar();
}

function desenhar() {
  const ev = contexto.evento;
  const sit = SITUACAO_EVENTO[ev.situacao] || SITUACAO_EVENTO.planejamento;
  const alvo = document.querySelector('#conteudo');
  registrarView(desenhar);   // o olhinho repinta o contrato sem sair dele

  alvo.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <button class="botao voltar" id="voltar">← Contratos</button>
      ${(contexto.permissao?.admin && ev.situacao !== 'encerrado')
        ? `<button class="botao botao-perigo" id="ev-excluir" style="height:32px;font-size:13px">Excluir contrato</button>` : ''}
    </div>

    <div class="evento-cabeca">
      ${ev.logo_url
        ? `<img class="ec-logo" src="${esc(ev.logo_url)}" alt="">`
        : `<div class="ec-logo ec-vazia">${esc(iniciais(ev.nome))}</div>`}
      <div style="min-width:0;flex:1">
        <h1>${esc(ev.nome)}</h1>
        <div class="ec-meta">
          ${esc(periodo(ev.data_inicio, ev.data_fim))}
          ${ev.cidade ? ' · ' + esc(ev.cidade) : ''}
          ${ev.publico_estimado ? ' · ' + numero(ev.publico_estimado) + ' pessoas' : ''}
        </div>
      </div>
      <span class="etiqueta ${sit.classe}">${sit.rotulo}</span>
    </div>

    <nav class="abas">
      ${abasVisiveis().map(a => `
        <button class="aba ${a.id === contexto.aba ? 'ativa' : ''} ${a.embreve ? 'embreve' : ''}"
                data-aba="${a.id}" ${a.embreve ? 'disabled' : ''}>
          ${esc(a.rotulo)}${a.embreve ? '<span class="tag-breve">em breve</span>' : ''}
        </button>`).join('')}
    </nav>

    <div id="aba-conteudo"></div>
  `;

  alvo.querySelector('#voltar').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('voltar-eventos'));
  });
  const btnExcluir = alvo.querySelector('#ev-excluir');
  if (btnExcluir) btnExcluir.addEventListener('click', async () => {
    const n = (contexto.itens || []).length;
    if (n > 0) {
      const r = prompt(`Este contrato tem ${n} item(ns). Excluir APAGA o contrato e TODOS os seus dados (itens, solicitações, pagamentos, receitas). Ação irreversível.\n\nDigite EXCLUIR para confirmar:`);
      if (r !== 'EXCLUIR') return;
    } else {
      if (!confirm('Excluir este contrato? Esta ação é irreversível.')) return;
    }
    try {
      await apagarEvento(ev.id);
      aviso('Contrato excluído.');
      document.dispatchEvent(new CustomEvent('voltar-eventos'));
    } catch (e) { aviso(e.message, 'erro'); }
  });
  alvo.querySelectorAll('[data-aba]').forEach(b => {
    b.addEventListener('click', () => { contexto.aba = b.dataset.aba; desenhar(); });
  });

  const corpo = alvo.querySelector('#aba-conteudo');
  if (contexto.aba === 'classificacao')      abaClassificacao(corpo);
  else if (contexto.aba === 'receitas')      abaReceitas(corpo);
  else if (contexto.aba === 'prestacao')     abaPrestacaoPreview(corpo);
  else                                       abaPainel(corpo);
}

/* ── painel do contrato ──────────────────────────────── */

function pontinho(cor) {
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${cor};margin-right:5px;vertical-align:middle"></span>`;
}

// Prévia da Prestação de contas — a função definitiva depende do
// modelo exigido pelo órgão; aqui mostramos a visão do que virá.
function abaPrestacaoPreview(alvo) {
  alvo.innerHTML = `
    <div class="cartao" style="max-width:760px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <h2 style="margin:0;font-size:18px">Prestação de contas</h2>
        <span class="etiqueta etiqueta-acento">Em desenvolvimento</span>
      </div>
      <p style="color:var(--texto-2);font-size:14px;margin-bottom:18px">
        Aqui o sistema vai gerar o relatório de prestação de contas deste contrato,
        pronto para entrega ao órgão — com exportação em PDF. O formato final será
        ajustado ao modelo exigido pelo concedente.
      </p>

      <div style="font-size:13px;font-weight:600;color:var(--texto-2);margin-bottom:8px">O relatório vai reunir:</div>
      <ul style="font-size:14px;line-height:1.9;margin:0 0 20px 18px">
        <li><b>Execução por rubrica</b> — orçado × pago em cada categoria, com saldo</li>
        <li><b>Repasses recebidos</b> × <b>despesas realizadas</b>, por fonte de recurso</li>
        <li><b>Relação de pagamentos</b> com fornecedor, data e comprovante</li>
        <li><b>Saldo do contrato</b> e conciliação com o extrato</li>
      </ul>

      <div style="font-size:12px;color:var(--texto-3);margin-bottom:8px">Prévia do quadro por rubrica</div>
      <table class="tabela" style="opacity:.75">
        <thead>
          <tr><th>Rubrica</th><th class="num">Orçado</th><th class="num">Pago</th><th class="num">Saldo</th></tr>
        </thead>
        <tbody>
          <tr><td>Recursos humanos</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>
          <tr><td>Serviços de terceiros (PJ)</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>
          <tr><td>Material de consumo</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>
        </tbody>
      </table>

      <p style="font-size:12px;color:var(--texto-3);margin-top:16px">
        Assim que o Instituto enviar o modelo de prestação de contas usado, montamos este relatório no formato exato.
      </p>
    </div>`;
}

async function abaPainel(alvo) {
  const ev = contexto.evento;
  alvo.innerHTML = `<div style="padding:30px;text-align:center;color:var(--texto-2)">Carregando painel...</div>`;

  // Modelo novo: orçamento vem da Classificação (folhas) e o realizado
  // vem dos Lançamentos. Nada de item_producao/solicitações aqui.
  let nos = [], lancs = [];
  try {
    [nos, lancs] = await Promise.all([listarClassificacao(ev.id), listarLancamentos(ev.id)]);
  } catch (e) { /* segue com o que tiver */ }

  // sem classificação: convida a montar o plano de contas
  if (!nos.length) {
    alvo.innerHTML = `
      <div class="vazio">
        <h3>Sem plano de contas</h3>
        <p>Comece pela aba <b>Classificação</b>: importe a planilha do contrato ou monte as rubricas. É nela que entra o orçado e, depois, os lançamentos.</p>
        <button class="botao botao-primario" id="ir-classificacao">Ir para Classificação</button>
      </div>`;
    alvo.querySelector('#ir-classificacao')?.addEventListener('click', () => {
      contexto.aba = 'classificacao'; desenhar();
    });
    return;
  }

  // receitas — só para quem pode ver (dado sensível)
  const podeVerReceitas = contexto.permissao?.admin || contexto.permissao?.ver_receitas;
  let receitas = [];
  if (podeVerReceitas) {
    try { receitas = await listarReceitas(ev.id); } catch (e) { receitas = []; }
  }

  // ── orçado (folhas) · realizado = comprometido (pago + a pagar) ──
  const folhas = nos.filter(n => !n.eh_grupo);
  const orcado = folhas.reduce((a, n) => a + Number(n.valor_orcado || 0), 0);
  const pago = lancs.filter(l => l.data_pagamento).reduce((a, l) => a + Number(l.valor || 0), 0);
  const aPagar = lancs.filter(l => !l.data_pagamento).reduce((a, l) => a + Number(l.valor || 0), 0);
  const realizado = pago + aPagar;            // comprometido
  const saldo = orcado - realizado;
  const pctPago = orcado > 0 ? Math.round(pago / orcado * 100) : 0;
  const pctAPagar = orcado > 0 ? Math.round(aPagar / orcado * 100) : 0;
  const nLancPagos = lancs.filter(l => l.data_pagamento).length;
  const nLancAPagar = lancs.length - nLancPagos;

  // ── por rubrica de topo (código sem ponto: A, B, C…) ──
  const topo = {};   // codigoTopo -> { nome, orcado, pago, aPagar }
  const nomeTopo = {};
  nos.forEach(n => {
    const t = (n.codigo || '').split('.')[0] || '—';
    if ((n.nivel || 0) === 0) nomeTopo[t] = n.nome;
  });
  const novoTopo = t => ({ nome: nomeTopo[t] || (t === '—' ? 'Sem rubrica' : t), orcado: 0, pago: 0, aPagar: 0 });
  folhas.forEach(n => {
    const t = (n.codigo || '').split('.')[0] || '—';
    if (!topo[t]) topo[t] = novoTopo(t);
    topo[t].orcado += Number(n.valor_orcado || 0);
  });
  const folhaPorId = {};
  folhas.forEach(n => { folhaPorId[n.id] = n; });
  lancs.forEach(l => {
    const f = folhaPorId[l.classificacao_id];
    const t = f ? ((f.codigo || '').split('.')[0] || '—') : '—';
    if (!topo[t]) topo[t] = novoTopo(t);
    if (l.data_pagamento) topo[t].pago += Number(l.valor || 0);
    else topo[t].aPagar += Number(l.valor || 0);
  });
  const rubricas = Object.entries(topo).sort((a, b) => b[1].orcado - a[1].orcado);

  // receitas: totais, resultado e por fonte
  const receitaPrevista = receitas.reduce((a, r) => a + Number(r.valor_previsto || 0), 0);
  const recebido = receitas.reduce((a, r) => a + Number(r.recebido || 0), 0);
  const resultadoPrevisto = receitaPrevista - orcado;
  const resultadoReal = recebido - pago;   // fluxo de caixa: recebido − efetivamente pago
  const aReceberEv = Math.max(receitaPrevista - recebido, 0);
  const podeEncerrar = contexto.permissao?.admin
    && ev.situacao !== 'encerrado'
    && realizado > 0.005 && saldo >= -0.005 && aReceberEv <= 0.005;
  const porFonte = {};
  receitas.forEach(r => {
    const k = r.fonte_nome || 'Sem fonte';
    if (!porFonte[k]) porFonte[k] = { previsto: 0, recebido: 0 };
    porFonte[k].previsto += Number(r.valor_previsto || 0);
    porFonte[k].recebido += Number(r.recebido || 0);
  });
  const fontes = Object.entries(porFonte).sort((a, b) => b[1].previsto - a[1].previsto);

  // contagem regressiva
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ini = ev.data_inicio ? new Date(ev.data_inicio + 'T00:00:00') : null;
  const dias = ini ? Math.round((ini - hoje) / 86400000) : null;

  alvo.innerHTML = `
    <div style="display:flex;justify-content:${podeEncerrar ? 'space-between' : 'flex-end'};align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      ${podeEncerrar ? `<span class="etiqueta etiqueta-verde">Dentro do orçado — pronto para encerrar</span>` : ''}
      <div style="display:flex;gap:8px">
        ${podeEncerrar ? `<button class="botao botao-primario" id="ev-encerrar" style="height:32px;font-size:13px">Encerrar contrato</button>` : ''}
        <button class="botao" id="ev-pdf" style="height:32px;font-size:13px">Exportar PDF</button>
      </div>
    </div>
    <div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-bottom:20px">
      <div class="cartao">
        <div style="font-weight:600;font-size:12px;color:var(--texto-2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.03em">Orçado × Realizado</div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
          <span>Orçado <b class="num">${moeda(orcado)}</b></span>
          <span>Comprometido <b class="num" style="color:${realizado > orcado ? 'var(--vermelho)' : 'var(--texto)'}">${moeda(realizado)}</b></span>
        </div>
        <div style="display:flex;height:10px;border-radius:20px;background:var(--superficie-2);overflow:hidden">
          <div style="height:100%;width:${Math.min(100, pctPago)}%;background:var(--verde)"></div>
          <div style="height:100%;width:${Math.min(100 - Math.min(100, pctPago), pctAPagar)}%;background:var(--ambar)"></div>
        </div>
        <div class="rotulo" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px 14px">
          <span>${pontinho('var(--verde)')}Pago <b class="num">${moeda(pago)}</b></span>
          <span>${pontinho('var(--ambar)')}A pagar <b class="num">${moeda(aPagar)}</b></span>
        </div>
        <div class="rotulo" style="margin-top:4px">saldo sobre o orçado <b class="num" style="color:${saldo < 0 ? 'var(--vermelho)' : 'var(--texto)'}">${moeda(saldo)}</b></div>
      </div>
      ${podeVerReceitas ? `
      <div class="cartao">
        <div style="font-weight:600;font-size:12px;color:var(--texto-2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.03em">Prevista × Recebida</div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
          <span>Prevista <b class="num">${moeda(receitaPrevista)}</b></span>
          <span>Recebida <b class="num" style="color:var(--verde)">${moeda(recebido)}</b></span>
        </div>
        <div style="height:10px;border-radius:20px;background:var(--superficie-2);overflow:hidden"><div style="height:100%;width:${receitaPrevista > 0 ? Math.min(100, Math.round(recebido / receitaPrevista * 100)) : 0}%;background:var(--verde)"></div></div>
        <div class="rotulo" style="margin-top:5px">${receitaPrevista > 0 ? Math.round(recebido / receitaPrevista * 100) : 0}% recebido</div>
      </div>
      <div class="cartao">
        <div style="font-weight:600;font-size:12px;color:var(--texto-2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.03em">Resultado previsto × Fluxo real</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px">
          <div><div class="rotulo">Previsto</div><div style="font-weight:700;font-size:18px;color:${resultadoPrevisto >= 0 ? 'var(--verde)' : 'var(--vermelho)'}">${resultadoPrevisto >= 0 ? '+' : ''}${moeda(resultadoPrevisto)}</div></div>
          <div style="text-align:right"><div class="rotulo">Fluxo real</div><div style="font-weight:700;font-size:18px;color:${resultadoReal >= 0 ? 'var(--verde)' : 'var(--vermelho)'}">${resultadoReal >= 0 ? '+' : ''}${moeda(resultadoReal)}</div></div>
        </div>
        <div class="rotulo" style="margin-top:6px">previsto = repasse − orçado · real = recebido − pago</div>
      </div>` : ''}
    </div>

    ${ini ? `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <div class="cartao" style="padding:10px 22px;text-align:center;min-width:118px">
          <div class="rotulo">${dias > 0 ? 'Faltam' : dias === 0 ? '' : 'Começou há'}</div>
          <div style="font-size:34px;font-weight:600;line-height:1.05">${dias === 0 ? 'Hoje' : numero(Math.abs(dias))}</div>
          <div class="rotulo">${dias === 0 ? dataBR(ev.data_inicio) : 'dias · ' + dataBR(ev.data_inicio)}</div>
        </div>
      </div>` : ''}

    <h2 style="font-size:15px;margin:24px 0 10px">Resumo</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
      <div class="metrica">
        <div class="rotulo">Orçado</div>
        <div class="valor">${moeda(orcado)}</div>
        <div class="rotulo" style="margin-top:2px">${numero(folhas.length)} ${folhas.length === 1 ? 'rubrica' : 'rubricas'}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">Pago</div>
        <div class="valor" style="color:var(--verde)">${moeda(pago)}</div>
        <div class="rotulo" style="margin-top:2px">${numero(nLancPagos)} ${nLancPagos === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">A pagar (programado)</div>
        <div class="valor" style="color:${aPagar > 0 ? 'var(--ambar)' : 'var(--texto-2)'}">${moeda(aPagar)}</div>
        <div class="rotulo" style="margin-top:2px">${numero(nLancAPagar)} ${nLancAPagar === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">Saldo</div>
        <div class="valor" style="color:${saldo < 0 ? 'var(--vermelho)' : 'var(--verde)'}">${moeda(saldo)}</div>
        <div class="rotulo" style="margin-top:2px">${saldo < 0 ? 'acima do orçado' : 'orçado − comprometido'}</div>
      </div>
    </div>

    <h2 style="font-size:15px;margin:24px 0 10px">Execução por rubrica <span class="rotulo" style="font-weight:400">· toque para abrir na Classificação</span></h2>
    <div class="cartao">
      ${rubricas.map(([cod, v]) => {
        const comprometido = v.pago + v.aPagar;
        const pctP = v.orcado > 0 ? Math.round(v.pago / v.orcado * 100) : (v.pago > 0 ? 100 : 0);
        const pctA = v.orcado > 0 ? Math.round(v.aPagar / v.orcado * 100) : (v.aPagar > 0 ? 100 - pctP : 0);
        const estouro = comprometido > v.orcado + 0.005;
        return `
        <div style="margin-bottom:14px;cursor:pointer" data-ir-classificacao="1">
          <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:4px">
            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b style="color:var(--texto-3);font-weight:600;margin-right:4px">${esc(cod)}</b>${esc(v.nome)}</span>
            <span style="white-space:nowrap">
              <span class="num" style="color:var(--verde);font-weight:500">${moeda(v.pago)}</span>${v.aPagar > 0.005 ? ` <span class="num" style="color:var(--ambar)">+${moeda(v.aPagar)}</span>` : ''} <span style="color:var(--texto-3)">/ ${moeda(v.orcado)}</span>${estouro ? ' <span style="color:var(--vermelho)">⚠</span>' : ''}
            </span>
          </div>
          <div style="display:flex;height:8px;background:var(--superficie-2);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${Math.min(100, pctP)}%;background:var(--verde)"></div>
            <div style="height:100%;width:${Math.min(100 - Math.min(100, pctP), pctA)}%;background:var(--ambar)"></div>
          </div>
        </div>`;
      }).join('')}
      <div class="rotulo" style="margin-top:6px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <span>${pontinho('var(--verde)')}pago</span>
        <span>${pontinho('var(--ambar)')}a pagar</span>
        <span>${pontinho('var(--borda-forte)')}orçado</span>
      </div>
    </div>

    ${podeVerReceitas ? (receitas.length ? `
      <h2 style="font-size:15px;margin:24px 0 10px">Repasses por fonte</h2>
      <div class="cartao">
        ${fontes.map(([nome, v]) => {
          const p = v.previsto > 0 ? Math.round(v.recebido / v.previsto * 100) : 0;
          return `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:4px">
              <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nome)}</span>
              <span style="white-space:nowrap"><span class="num" style="color:var(--verde);font-weight:500">${moeda(v.recebido)}</span> <span style="color:var(--texto-3)">/ ${moeda(v.previsto)}</span></span>
            </div>
            <div style="height:8px;background:var(--superficie-2);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${p}%;background:var(--verde)"></div>
            </div>
          </div>`;
        }).join('')}
        <div class="rotulo" style="margin-top:6px;display:flex;gap:16px;align-items:center">
          <span>${pontinho('var(--verde)')}recebido</span>
          <span>${pontinho('var(--borda-forte)')}previsto</span>
        </div>
      </div>` : `
      <h2 style="font-size:15px;margin:24px 0 10px">Repasses por fonte</h2>
      <div class="cartao" style="color:var(--texto-2);font-size:14px">Nenhum repasse cadastrado ainda.</div>`) : ''}
  `;

  alvo.querySelectorAll('[data-ir-classificacao]').forEach(el =>
    el.addEventListener('click', () => { contexto.aba = 'classificacao'; desenhar(); }));
  alvo.querySelector('#ev-pdf')?.addEventListener('click', () => window.print());
  alvo.querySelector('#ev-encerrar')?.addEventListener('click', async () => {
    if (!confirm('Encerrar este contrato? Isso trava novos lançamentos. Dá pra reabrir depois mudando a situação no cadastro do contrato.')) return;
    try {
      await encerrarEvento(ev.id);
      contexto.evento.situacao = 'encerrado';
      aviso('Contrato encerrado.');
      desenhar();
    } catch (e) { aviso(e.message, 'erro'); }
  });
}
