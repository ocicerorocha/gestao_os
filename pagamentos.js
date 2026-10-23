// ═══════════════════════════════════════════════════════
// Financeiro — a visão de caixa dos lançamentos
//
// Junta os lançamentos de todos os contratos da organização e
// separa em A PAGAR (sem data de pagamento) e PAGOS. É o lugar
// de quem paga: na segunda ninguém paga "o contrato X", paga o
// que vence naquele dia, venha de onde vier.
// ═══════════════════════════════════════════════════════

import {
  empresaAtual, lancamentosEmpresa, marcarLancamentoPago, reabrirLancamento,
} from './nucleo.js';
import { esc, aviso, abrirModal, fecharModal, comBotao, moeda, dataBR } from './ui.js';

let _lancs = [];
let _filtroEvento = '';
let _aba = 'apagar';   // 'apagar' | 'pagos'

const hoje = () => new Date().toISOString().slice(0, 10);
function somarDias(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function nomeDoDia(iso) {
  const h = hoje();
  if (iso === h) return 'Hoje, ' + dataBR(iso);
  if (iso === somarDias(h, 1)) return 'Amanhã, ' + dataBR(iso);
  const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  return `${dias[new Date(iso + 'T12:00:00').getDay()]}, ${dataBR(iso)}`;
}
function desc(l) { return l.descricao || l.fornecedor?.nome || (l.classificacao ? l.classificacao.nome : 'Lançamento'); }

function abas() {
  const apagar = _lancs.filter(l => !l.data_pagamento).length;
  const pagos = _lancs.filter(l => l.data_pagamento).length;
  return `
    <div class="abas" style="margin-bottom:16px">
      <button class="aba ${_aba === 'apagar' ? 'ativa' : ''}" data-aba="apagar">A pagar${apagar ? ' (' + apagar + ')' : ''}</button>
      <button class="aba ${_aba === 'pagos' ? 'ativa' : ''}" data-aba="pagos">Pagos${pagos ? ' (' + pagos + ')' : ''}</button>
    </div>`;
}

function seletorContrato() {
  const eventos = [...new Map(_lancs.map(l => [l.evento_id, l.evento_nome])).entries()];
  return `
    <div class="barra-filtros">
      <select class="controle" id="f-evento" style="width:auto;min-width:200px">
        <option value="">Todos os contratos</option>
        ${eventos.map(([id, nome]) => `<option value="${esc(id)}" ${_filtroEvento === id ? 'selected' : ''}>${esc(nome)}</option>`).join('')}
      </select>
    </div>`;
}

export async function telaPagamentos() {
  const alvo = document.querySelector('#conteudo');
  const emp = empresaAtual();
  if (!emp) {
    alvo.innerHTML = `<div class="vazio"><h3>Sem organização</h3><p>Você não está vinculado a nenhuma organização.</p></div>`;
    return;
  }
  alvo.innerHTML = `<div style="padding:40px;text-align:center;color:var(--texto-2)">Carregando financeiro...</div>`;
  try { _lancs = await lancamentosEmpresa(emp.id); }
  catch (e) { alvo.innerHTML = `<div class="vazio"><h3>Não consegui carregar</h3><p>${esc(e.message)}</p></div>`; return; }
  desenhar(alvo);
}

function desenhar(alvo) {
  if (_aba === 'pagos') return renderPagos(alvo);

  let linhas = _lancs.filter(l => !l.data_pagamento);
  if (_filtroEvento) linhas = linhas.filter(l => l.evento_id === _filtroEvento);
  const h = hoje();

  const vencidas = linhas.filter(l => l.data_vencimento && l.data_vencimento < h);
  const semData  = linhas.filter(l => !l.data_vencimento);
  const futuras  = linhas.filter(l => l.data_vencimento && l.data_vencimento >= h);

  const porDia = new Map();
  futuras.forEach(l => { if (!porDia.has(l.data_vencimento)) porDia.set(l.data_vencimento, []); porDia.get(l.data_vencimento).push(l); });
  const dias = [...porDia.keys()].sort();

  const soma = arr => arr.reduce((a, l) => a + Number(l.valor || 0), 0);
  const totalVencido = soma(vencidas);
  const total7 = soma(futuras.filter(l => l.data_vencimento <= somarDias(h, 7)));
  const totalTudo = soma(linhas);
  let acumulado = totalVencido;

  alvo.innerHTML = `
    <div class="pagina-topo"><h1>Financeiro</h1></div>
    ${abas()}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px">
      <div class="metrica">
        <div class="rotulo">Vencido</div>
        <div class="valor" style="color:${totalVencido > 0 ? 'var(--vermelho)' : 'var(--texto-2)'}">${moeda(totalVencido)}</div>
        <div class="rotulo" style="margin-top:2px">${vencidas.length} ${vencidas.length === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">Próximos 7 dias</div>
        <div class="valor" style="color:var(--ambar)">${moeda(total7)}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">Total a pagar</div>
        <div class="valor">${moeda(totalTudo)}</div>
        <div class="rotulo" style="margin-top:2px">${linhas.length} ${linhas.length === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
    </div>

    ${seletorContrato()}

    ${!linhas.length ? `
      <div class="vazio">
        <h3>Nada a pagar</h3>
        <p>Lançamentos marcados como "A pagar" aparecem aqui${_filtroEvento ? ' para este contrato' : ''}. Crie um lançamento na Classificação do contrato.</p>
      </div>` : ''}

    ${vencidas.length ? `
      <div class="dia-cabeca vencido"><span>Vencido</span><span class="num">${moeda(totalVencido)}</span></div>
      ${vencidas.map(l => cartao(l, true)).join('')}` : ''}

    ${dias.map(d => {
      const doDia = porDia.get(d);
      const totalDia = soma(doDia);
      acumulado += totalDia;
      return `
        <div class="dia-cabeca">
          <span>${nomeDoDia(d)}</span>
          <span class="num">${moeda(totalDia)}</span>
          <span class="acumulado">acumulado ${moeda(acumulado)}</span>
        </div>
        ${doDia.map(l => cartao(l, false)).join('')}`;
    }).join('')}

    ${semData.length ? `
      <div class="dia-cabeca"><span>Sem previsão de pagamento</span><span class="num">${moeda(soma(semData))}</span></div>
      ${semData.map(l => cartao(l, false)).join('')}` : ''}
  `;

  ligarEventos(alvo);
}

function cartao(l, vencido) {
  return `
    <div class="pag-cartao ${vencido ? 'vencido' : ''}" data-detalhe="${esc(l.id)}" style="cursor:pointer">
      <span class="marca"></span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500">${esc(desc(l))}</div>
        <div style="font-size:12px;color:var(--texto-2)">
          ${esc(l.fornecedor?.nome || 'sem favorecido')} · ${esc(l.evento_nome)}
          ${l.classificacao ? ' · ' + esc((l.classificacao.codigo ? l.classificacao.codigo + ' ' : '') + l.classificacao.nome) : ''}
          ${l.data_vencimento ? ' · vence ' + dataBR(l.data_vencimento) : ' · sem data'}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:17px;font-weight:600;font-variant-numeric:tabular-nums">${moeda(l.valor)}</div>
        <div style="display:flex;gap:4px;margin-top:6px;justify-content:flex-end;flex-wrap:wrap">
          <button class="botao botao-primario" style="height:30px;font-size:12px;padding:0 12px" data-pagar="${esc(l.id)}">Marcar como pago</button>
        </div>
      </div>
    </div>`;
}

function renderPagos(alvo) {
  let pagos = _lancs.filter(l => l.data_pagamento);
  if (_filtroEvento) pagos = pagos.filter(l => l.evento_id === _filtroEvento);
  pagos.sort((a, b) => String(b.data_pagamento).localeCompare(String(a.data_pagamento)));
  const total = pagos.reduce((a, p) => a + Number(p.valor || 0), 0);

  alvo.innerHTML = `
    <div class="pagina-topo"><h1>Financeiro</h1></div>
    ${abas()}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px">
      <div class="metrica">
        <div class="rotulo">Total pago</div>
        <div class="valor" style="color:var(--verde)">${moeda(total)}</div>
        <div class="rotulo" style="margin-top:2px">${pagos.length} ${pagos.length === 1 ? 'lançamento' : 'lançamentos'}</div>
      </div>
    </div>

    ${seletorContrato()}

    ${!pagos.length ? `
      <div class="vazio"><h3>Nenhum pagamento ainda</h3>
        <p>Lançamentos marcados como pagos aparecem aqui${_filtroEvento ? ' para este contrato' : ''}.</p></div>` : `
      <div class="cartao" style="padding:0;overflow:hidden">
        ${pagos.map(p => `
          <div class="linha-lista" data-detalhe="${esc(p.id)}" style="cursor:pointer">
            <div style="flex:1;min-width:0">
              <div style="font-weight:500;font-size:14px">${esc(desc(p))}</div>
              <div style="font-size:12px;color:var(--texto-2)">
                ${esc(p.fornecedor?.nome || 'sem favorecido')} · ${esc(p.evento_nome)} · pago ${dataBR(p.data_pagamento)}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
              <span class="num" style="font-weight:600;color:var(--verde)">${moeda(p.valor)}</span>
              <button class="botao" style="height:28px;font-size:12px;padding:0 10px" data-reabrir="${esc(p.id)}">Reabrir</button>
            </div>
          </div>`).join('')}
      </div>`}
  `;

  ligarEventos(alvo);
}

function ligarEventos(alvo) {
  alvo.querySelectorAll('[data-aba]').forEach(b =>
    b.addEventListener('click', () => { _aba = b.dataset.aba; desenhar(alvo); }));
  alvo.querySelector('#f-evento')?.addEventListener('change', e => { _filtroEvento = e.target.value; desenhar(alvo); });
  alvo.querySelectorAll('[data-detalhe]').forEach(el =>
    el.addEventListener('click', () => modalDetalhe(el.dataset.detalhe)));
  alvo.querySelectorAll('[data-pagar]').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); modalPagar(b.dataset.pagar); }));
  alvo.querySelectorAll('[data-reabrir]').forEach(b =>
    b.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Reabrir este lançamento? Ele volta para "A pagar".')) return;
      try { await reabrirLancamento(b.dataset.reabrir); aviso('Reaberto.'); await telaPagamentos(); }
      catch (e2) { aviso(e2.message, 'erro'); }
    }));
}

function linhaInfo(rotulo, valor) {
  if (valor == null || valor === '') return '';
  return `<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--borda);font-size:13px">
    <span style="color:var(--texto-2)">${esc(rotulo)}</span>
    <span style="text-align:right;min-width:0">${esc(valor)}</span></div>`;
}

function modalDetalhe(id) {
  const l = _lancs.find(x => x.id === id);
  if (!l) return;
  const pago = !!l.data_pagamento;
  abrirModal('Detalhe do lançamento', `
    <div style="margin-bottom:12px">
      <div style="font-weight:600;font-size:16px">${esc(desc(l))}</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px;color:${pago ? 'var(--verde)' : 'var(--texto)'}">${moeda(l.valor)}</div>
      <span class="etiqueta ${pago ? 'etiqueta-verde' : 'etiqueta-ambar'}" style="margin-top:6px;display:inline-block">${pago ? 'Pago' : 'A pagar'}</span>
    </div>
    <div style="margin-bottom:14px">
      ${linhaInfo('Fornecedor', l.fornecedor?.nome)}
      ${linhaInfo('Contrato', l.evento_nome)}
      ${linhaInfo('Rubrica', l.classificacao ? (l.classificacao.codigo ? l.classificacao.codigo + ' · ' : '') + l.classificacao.nome : null)}
      ${linhaInfo('Descrição', l.descricao)}
      ${linhaInfo('Nº do documento / nota', l.documento_numero)}
      ${linhaInfo('Forma de pagamento', l.forma_pagamento)}
      ${linhaInfo('Emissão', l.data_competencia ? dataBR(l.data_competencia) : null)}
      ${pago
        ? linhaInfo('Data do pagamento', dataBR(l.data_pagamento))
        : linhaInfo('Previsão de pagamento', l.data_vencimento ? dataBR(l.data_vencimento) : 'sem data')}
    </div>
    <div class="modal-acoes">
      ${pago
        ? `<button type="button" class="botao" id="d-reabrir" style="margin-right:auto">Reabrir (voltar p/ a pagar)</button>`
        : `<button type="button" class="botao botao-primario" id="d-pagar" style="margin-right:auto">Marcar como pago</button>`}
      <button type="button" class="botao" id="d-fechar">Fechar</button>
    </div>`);
  const q = s => document.querySelector(s);
  q('#d-fechar').addEventListener('click', fecharModal);
  q('#d-pagar')?.addEventListener('click', () => { fecharModal(); modalPagar(id); });
  q('#d-reabrir')?.addEventListener('click', async () => {
    if (!confirm('Reabrir este lançamento? Ele volta para "A pagar".')) return;
    try { await reabrirLancamento(id); aviso('Reaberto.'); fecharModal(); await telaPagamentos(); }
    catch (e) { aviso(e.message, 'erro'); }
  });
}

function modalPagar(id) {
  const l = _lancs.find(x => x.id === id);
  if (!l) return;
  abrirModal('Marcar como pago', `
    <div style="margin-bottom:14px">
      <div style="font-weight:600;font-size:15px">${esc(desc(l))}</div>
      <div style="font-size:13px;color:var(--texto-2)">${esc(l.fornecedor?.nome || 'sem favorecido')} · ${esc(l.evento_nome)} · ${moeda(l.valor)}</div>
    </div>
    <form id="fpg">
      <div class="campo">
        <label for="pg-data">Data do pagamento</label>
        <input class="controle" id="pg-data" type="date" value="${hoje()}" required>
      </div>
      <div class="modal-acoes">
        <button type="button" class="botao" id="pg-cancelar">Cancelar</button>
        <button type="submit" class="botao botao-primario" id="pg-salvar">Confirmar pagamento</button>
      </div>
    </form>`);
  const q = s => document.querySelector(s);
  q('#pg-cancelar').addEventListener('click', fecharModal);
  q('#fpg').addEventListener('submit', async e => {
    e.preventDefault();
    await comBotao(q('#pg-salvar'), async () => {
      try {
        await marcarLancamentoPago(id, q('#pg-data').value);
        aviso('Pagamento registrado.');
        fecharModal();
        await telaPagamentos();
      } catch (err) { aviso(err.message, 'erro'); }
    });
  });
}
