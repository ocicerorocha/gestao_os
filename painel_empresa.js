// ═══════════════════════════════════════════════════════
// Painel da organização — a visão geral dos contratos
//
// Não soma tudo num total só: cada contrato (ordem de serviço)
// é prestado em separado. O painel compara os contratos entre
// si — orçado × realizado, saldo e andamento. Respeita o
// olhinho (moeda mascarada).
// ═══════════════════════════════════════════════════════

import { empresaAtual, resumoContratosOS } from './nucleo.js';
import { esc, moeda, numero, dataBR, SITUACAO_EVENTO, registrarView, privadoAtivo } from './ui.js';
import { telaEvento } from './evento.js';

let _dados = null;
let _ordem = 'orcado';   // orcado | realizado | saldo | nome

export async function telaPainelEmpresa() {
  const alvo = document.querySelector('#conteudo');
  const emp = empresaAtual();
  alvo.innerHTML = `<div style="padding:40px;text-align:center;color:var(--texto-2)">Carregando o painel...</div>`;

  try {
    const contratos = await resumoContratosOS(emp.id);
    _dados = { emp, contratos };
  } catch (e) {
    alvo.innerHTML = `<div class="vazio"><h3>Não consegui abrir o painel</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  registrarView(desenhar);   // o olhinho repinta daqui, sem refazer as consultas
  desenhar();
}

function desenhar() {
  const alvo = document.querySelector('#conteudo');
  if (!_dados) return;
  const { contratos } = _dados;

  const cEv = { planejamento: 0, em_execucao: 0, encerrado: 0 };
  contratos.forEach(e => { const s = e.situacao || 'planejamento'; if (cEv[s] != null) cEv[s]++; });

  // maior orçado define a escala das barras do comparativo
  const maxOrc = Math.max(1, ...contratos.map(e => Number(e.orcado || 0)));

  const ordenados = contratos.slice().sort((a, b) => {
    if (_ordem === 'nome') return String(a.nome).localeCompare(String(b.nome));
    if (_ordem === 'saldo') return (Number(a.orcado) - Number(a.realizado)) - (Number(b.orcado) - Number(b.realizado));
    return Number(b[_ordem] || 0) - Number(a[_ordem] || 0);
  });

  const oculto = privadoAtivo();

  alvo.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:6px">
      <h1 style="margin:0">${esc(_dados.emp?.nome || 'Painel')}</h1>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:13px;color:var(--texto-2)">${numero(contratos.length)} ${contratos.length === 1 ? 'contrato' : 'contratos'}</div>
        <button class="botao" id="pe-pdf" style="height:32px;font-size:13px">Exportar PDF</button>
      </div>
    </div>

    <div class="status-eventos">
      <div class="se"><div class="n">${numero(contratos.length)}</div><div class="l">Total</div></div>
      <div class="se"><div class="n" style="color:var(--texto-2)">${numero(cEv.planejamento)}</div><div class="l">Em planejamento</div></div>
      <div class="se"><div class="n" style="color:var(--acento-texto)">${numero(cEv.em_execucao)}</div><div class="l">Em execução</div></div>
      <div class="se"><div class="n" style="color:var(--verde)">${numero(cEv.encerrado)}</div><div class="l">Encerrado</div></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px;flex-wrap:wrap;gap:8px">
      <h2 style="font-size:15px;margin:0">Comparativo entre contratos</h2>
      <div style="display:flex;gap:6px">
        ${[['orcado', 'Orçado'], ['realizado', 'Realizado'], ['saldo', 'Saldo'], ['nome', 'A–Z']].map(([k, r]) =>
          `<button class="botao" data-ordem="${k}" style="height:30px;font-size:12px${_ordem === k ? ';border-color:var(--acento);color:var(--acento)' : ''}">${r}</button>`).join('')}
      </div>
    </div>
    <div style="display:flex;gap:16px;font-size:12px;color:var(--texto-2);margin-bottom:10px;flex-wrap:wrap">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--verde);margin-right:5px;vertical-align:middle"></span>Pago</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--ambar);margin-right:5px;vertical-align:middle"></span>A pagar</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--borda-forte);margin-right:5px;vertical-align:middle"></span>Orçado</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px">
      ${ordenados.length ? ordenados.map(e => cartaoContrato(e, maxOrc, oculto)).join('')
        : '<p class="dica">Nenhum contrato ainda. Crie um em Contratos e monte a Classificação.</p>'}
    </div>
  `;

  alvo.querySelectorAll('[data-ordem]').forEach(b =>
    b.addEventListener('click', () => { _ordem = b.dataset.ordem; desenhar(); }));
  alvo.querySelectorAll('[data-contrato]').forEach(el =>
    el.addEventListener('click', () => telaEvento(el.dataset.contrato)));
  alvo.querySelector('#pe-pdf')?.addEventListener('click', () => window.print());
}

function cartaoContrato(e, maxOrc, oculto) {
  const sit = SITUACAO_EVENTO[e.situacao] || SITUACAO_EVENTO.planejamento;
  const orc = Number(e.orcado || 0);
  const pago = Number(e.pago || 0), aPagar = Number(e.a_pagar || 0);
  const real = pago + aPagar;              // comprometido
  const saldo = orc - real;
  const pctExec = orc > 0 ? Math.round(real / orc * 100) : (real > 0 ? 100 : 0);
  const estouro = real > orc + 0.005;
  // largura das barras: proporção ao maior orçado da carteira (comparativo visual)
  const larguraOrc = Math.round(orc / maxOrc * 100);
  const larguraPago = Math.round(Math.min(pago, maxOrc) / maxOrc * 100);
  const larguraAPagar = Math.round(Math.min(aPagar, Math.max(0, maxOrc - pago)) / maxOrc * 100);

  return `
    <div class="cartao" data-contrato="${esc(e.id)}" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px">
        <strong style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.nome)}</strong>
        <span class="etiqueta ${sit.classe}">${sit.rotulo}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
        <div><div class="rotulo">Orçado</div><div style="font-weight:500" class="num">${moeda(orc)}</div></div>
        <div><div class="rotulo">Pago</div><div style="font-weight:500;color:var(--verde)" class="num">${moeda(pago)}</div></div>
        <div><div class="rotulo">A pagar</div><div style="font-weight:500;color:${aPagar > 0 ? 'var(--ambar)' : 'var(--texto-2)'}" class="num">${moeda(aPagar)}</div></div>
        <div><div class="rotulo">Saldo</div><div style="font-weight:500;color:${saldo < 0 ? 'var(--vermelho)' : 'var(--texto)'}" class="num">${moeda(saldo)}</div></div>
      </div>
      ${oculto ? '' : `
      <div style="position:relative;height:18px;background:var(--superficie-2);border-radius:5px;overflow:hidden">
        <div style="position:absolute;inset:0;width:${larguraOrc}%;background:var(--borda-forte);opacity:.5"></div>
        <div style="position:absolute;left:0;top:0;bottom:0;width:${larguraPago}%;background:var(--verde)"></div>
        <div style="position:absolute;left:${larguraPago}%;top:0;bottom:0;width:${larguraAPagar}%;background:var(--ambar)"></div>
      </div>`}
      <div class="rotulo" style="margin-top:5px">${pctExec}% comprometido${estouro ? ' · acima do orçado' : ''}</div>
    </div>`;
}
