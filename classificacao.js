// ═══════════════════════════════════════════════════════
// Classificação financeira — árvore de rubricas do contrato
//
// A árvore é o PLANEJADO (grupos, subgrupos e itens com o
// valor orçado). Os lançamentos (realizado) se amarram aos
// itens-folha. Importa o "Quadro Orçamentário Analítico".
// ═══════════════════════════════════════════════════════

import { contexto } from './evento.js';
import {
  listarClassificacao, importarClassificacao,
  salvarNoClassificacao, apagarNoClassificacao,
} from './nucleo.js';
import {
  esc, aviso, abrirModal, fecharModal, comBotao,
  moeda, numero, aplicarMascaraMoeda, lerMoeda,
} from './ui.js';

let _alvo = null;
const recarregar = () => _alvo && abaClassificacao(_alvo);

export async function abaClassificacao(alvo) {
  _alvo = alvo;
  if (!contexto.permissao) {
    alvo.innerHTML = `<div class="vazio"><h3>Sem acesso</h3></div>`;
    return;
  }
  alvo.innerHTML = `<div style="padding:30px;text-align:center;color:var(--texto-2)">Carregando classificação...</div>`;
  let nos;
  try { nos = await listarClassificacao(contexto.evento.id); }
  catch (e) { alvo.innerHTML = `<div class="vazio"><h3>Não consegui carregar</h3><p>${esc(e.message)}</p></div>`; return; }
  pintar(alvo, nos);
}

// Subtotal de um grupo = soma do orçado dos itens-folha abaixo dele (pelo código).
function subtotal(nos, g) {
  if (!g.codigo) return 0;
  const pref = g.codigo + '.';
  return nos.filter(n => !n.eh_grupo && (n.codigo || '').startsWith(pref))
            .reduce((a, n) => a + Number(n.valor_orcado || 0), 0);
}

function pintar(alvo, nos) {
  const podeEditar = contexto.permissao?.admin || contexto.permissao?.editar_producao;
  const grand = nos.filter(n => !n.eh_grupo).reduce((a, n) => a + Number(n.valor_orcado || 0), 0);

  const linhas = nos.map(n => {
    const ind = (n.nivel || 0) * 18;
    const cod = n.codigo ? `<span style="color:var(--texto-3);font-weight:500">${esc(n.codigo)}</span> ` : '';
    if (n.eh_grupo) {
      return `<div class="cl-linha" data-id="${esc(n.id)}" style="padding:8px;margin-left:${ind}px;display:flex;justify-content:space-between;gap:10px;font-weight:600;border-top:1px solid var(--borda);cursor:pointer">
        <span>${cod}${esc(n.nome)}</span><span style="white-space:nowrap">${moeda(subtotal(nos, n))}</span></div>`;
    }
    const q = n.qtde ? ` <span style="color:var(--texto-3);font-size:12px">· qtde ${numero(n.qtde)}</span>` : '';
    return `<div class="cl-linha" data-id="${esc(n.id)}" style="padding:6px 8px;margin-left:${ind}px;display:flex;justify-content:space-between;gap:10px;cursor:pointer">
      <span>${cod}${esc(n.nome)}${q}</span>
      <span style="white-space:nowrap">${n.valor_orcado != null ? moeda(n.valor_orcado) : '—'}</span></div>`;
  }).join('');

  alvo.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <div><div class="rotulo">Orçado total do contrato</div><div style="font-size:20px;font-weight:700">${moeda(grand)}</div></div>
      ${podeEditar ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="file" id="cl-arquivo" accept=".xlsx,.xls" style="display:none">
        <button class="botao" id="cl-importar">Importar planilha</button>
        <button class="botao" id="cl-novo">Adicionar linha</button>
      </div>` : ''}
    </div>
    ${nos.length ? `<div class="cartao" style="padding:2px">${linhas}</div>` : `
      <div class="vazio">
        <h3>Sem classificação ainda</h3>
        <p>Importe a planilha de classificação financeira do contrato (Quadro Orçamentário Analítico) para montar a árvore de rubricas.</p>
        ${podeEditar ? `<button class="botao botao-primario" id="cl-importar2">Importar planilha</button>` : ''}
      </div>`}`;

  if (!podeEditar) return;
  const q = s => document.querySelector(s);
  const abrir = () => q('#cl-arquivo').click();
  q('#cl-importar')?.addEventListener('click', abrir);
  q('#cl-importar2')?.addEventListener('click', abrir);
  q('#cl-arquivo')?.addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (f) await importarPlanilha(f, alvo);
  });
  q('#cl-novo')?.addEventListener('click', () => modalNo(null));
  alvo.querySelectorAll('.cl-linha').forEach(el =>
    el.addEventListener('click', () => {
      const no = nos.find(n => String(n.id) === el.dataset.id);
      if (no) modalNo(no);
    }));
}

/* ── importação da planilha (Quadro Analítico) ────────── */

// Lê as colunas Código(A) · Descrição(B) · Qtde(C) · Valor/mês(D) · Valor total(E).
// Pula as linhas de vagas (números soltos). Grupo = quem tem filhos.
function parseQuadro(rows) {
  const NODE = /^[A-Z]+(\.\d+)*$/;
  const raw = [];
  for (const row of rows) {
    const a = String(row[0] ?? '').trim();
    if (!NODE.test(a)) continue;
    const nome = String(row[1] ?? '').trim();
    const qt = typeof row[2] === 'number' ? row[2] : null;
    const mes = typeof row[3] === 'number' ? row[3] : null;
    const tot = typeof row[4] === 'number' ? row[4] : null;
    const nivel = a.includes('.') ? a.split('.').length - 1 : 0;
    raw.push({ codigo: a, nome, qtde: qt, valor_mes: mes, valor_orcado: tot, nivel });
  }
  const cods = new Set(raw.map(n => n.codigo));
  for (const n of raw) n.eh_grupo = [...cods].some(c => c !== n.codigo && c.startsWith(n.codigo + '.'));
  return raw;
}

async function importarPlanilha(file, alvo) {
  try {
    const XLSX = await import('./vendor/xlsx.js');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const aba = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(aba, { header: 1, blankrows: false, defval: '' });
    const nos = parseQuadro(rows);
    if (!nos.length) return aviso('Não encontrei a estrutura (código/descrição/valor) na planilha.', 'erro');
    const itens = nos.filter(n => !n.eh_grupo);
    const total = itens.reduce((a, n) => a + Number(n.valor_orcado || 0), 0);
    if (!confirm(`Importar ${nos.length} linhas (${itens.length} itens · total ${moeda(total)})?\n\nIsso substitui a classificação atual deste contrato.`)) return;
    await importarClassificacao(contexto.evento.id, nos);
    aviso('Classificação importada.');
    abaClassificacao(alvo);
  } catch (e) {
    aviso('Falha ao importar: ' + e.message, 'erro');
  }
}

/* ── editar/adicionar um nó ────────────────────────────── */

function modalNo(no) {
  const ed = !!no;
  const n = no || {};
  abrirModal(ed ? 'Editar linha' : 'Nova linha', `
    <form id="fcl">
      <div class="linha linha-2">
        <div class="campo">
          <label for="cl-cod">Código</label>
          <input class="controle" id="cl-cod" value="${esc(n.codigo || '')}" placeholder="ex.: 2.1.1">
        </div>
        <div class="campo" style="display:flex;flex-direction:column;justify-content:flex-end">
          <label class="caixa-perm" style="margin-bottom:10px">
            <input type="checkbox" id="cl-grupo" ${n.eh_grupo ? 'checked' : ''}>
            <span><span class="rot">É um grupo</span><span class="desc">Soma dos filhos; sem valor próprio</span></span>
          </label>
        </div>
      </div>
      <div class="campo">
        <label for="cl-nome">Nome</label>
        <input class="controle" id="cl-nome" value="${esc(n.nome || '')}" required>
      </div>
      <div class="linha linha-2">
        <div class="campo">
          <label for="cl-qtde">Quantidade</label>
          <input class="controle" type="number" step="0.01" id="cl-qtde" value="${n.qtde ?? ''}">
        </div>
        <div class="campo">
          <label for="cl-orc">Valor orçado (total)</label>
          <input class="controle" id="cl-orc" data-moeda value="${n.valor_orcado ?? ''}">
        </div>
      </div>
      <div class="modal-acoes">
        ${ed ? `<button type="button" class="botao botao-perigo" id="cl-apagar" style="margin-right:auto">Apagar</button>` : ''}
        <button type="button" class="botao" id="cl-cancelar">Cancelar</button>
        <button type="submit" class="botao botao-primario" id="cl-salvar">${ed ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`);

  aplicarMascaraMoeda();
  const q = s => document.querySelector(s);
  q('#cl-cancelar').addEventListener('click', fecharModal);
  q('#cl-apagar')?.addEventListener('click', async () => {
    if (!confirm('Apagar esta linha?')) return;
    try { await apagarNoClassificacao(n.id); aviso('Removido.'); fecharModal(); recarregar(); }
    catch (e) { aviso(e.message, 'erro'); }
  });
  q('#fcl').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = q('#cl-nome').value.trim();
    if (!nome) return aviso('Informe o nome.', 'aviso');
    const grupo = q('#cl-grupo').checked;
    const cod = q('#cl-cod').value.trim();
    const nivel = cod.includes('.') ? cod.split('.').length - 1 : 0;
    await comBotao(q('#cl-salvar'), async () => {
      try {
        await salvarNoClassificacao(contexto.evento.id, n.id || null, {
          codigo: cod, nome, eh_grupo: grupo, nivel,
          qtde: q('#cl-qtde').value || '',
          valor_mes: '',
          valor_orcado: grupo ? '' : lerMoeda(q('#cl-orc')),
          ordem: n.ordem,
        });
        aviso(ed ? 'Salvo.' : 'Adicionado.');
        fecharModal();
        recarregar();
      } catch (err) { aviso(err.message, 'erro'); }
    });
  });
}
