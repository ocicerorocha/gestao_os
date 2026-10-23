// ═══════════════════════════════════════════════════════
// Classificação financeira — árvore de rubricas do contrato
//
// A árvore é o PLANEJADO (grupos, subgrupos e itens com o
// valor orçado). Os LANÇAMENTOS (realizado) se amarram aos
// itens-folha. Importa o "Quadro Orçamentário Analítico".
// ═══════════════════════════════════════════════════════

import { contexto } from './evento.js';
import {
  listarClassificacao, importarClassificacao,
  salvarNoClassificacao, apagarNoClassificacao,
  listarLancamentos, salvarLancamento, apagarLancamento,
  listarCotacoesLanc, salvarCotacoesLanc,
  documentosDoLancamento, anexarDocumento, apagarDocumento, linkDocumento,
  listarFornecedores, empresaAtual,
} from './nucleo.js';
import {
  esc, aviso, abrirModal, fecharModal, comBotao,
  moeda, numero, dataBR, aplicarMascaraMoeda, lerMoeda, montarAnexos,
} from './ui.js';

let _alvo = null;
let _nos = [];
let _realizado = {};   // classificacao_id -> soma dos lançamentos
let _forns = null;     // cache de fornecedores (datalist)
let _initContrato = null;        // contrato cuja árvore já teve o colapso inicial
const _colapsados = new Set();   // códigos de grupo recolhidos
const recarregar = () => _alvo && abaClassificacao(_alvo);

// linha oculta porque algum grupo-pai está recolhido
function ocultoPorColapso(n) {
  const cod = n.codigo || '';
  return [..._colapsados].some(c => cod !== c && cod.startsWith(c + '.'));
}

export async function abaClassificacao(alvo) {
  _alvo = alvo;
  if (!contexto.permissao) {
    alvo.innerHTML = `<div class="vazio"><h3>Sem acesso</h3></div>`;
    return;
  }
  alvo.innerHTML = `<div style="padding:30px;text-align:center;color:var(--texto-2)">Carregando classificação...</div>`;
  let nos, lancs;
  try {
    [nos, lancs] = await Promise.all([
      listarClassificacao(contexto.evento.id),
      listarLancamentos(contexto.evento.id),
    ]);
  } catch (e) {
    alvo.innerHTML = `<div class="vazio"><h3>Não consegui carregar</h3><p>${esc(e.message)}</p></div>`;
    return;
  }
  _realizado = {};
  for (const l of lancs) {
    if (l.classificacao_id) _realizado[l.classificacao_id] = (_realizado[l.classificacao_id] || 0) + Number(l.valor || 0);
  }
  // Na primeira abertura deste contrato, mostra a árvore recolhida.
  if (_initContrato !== contexto.evento.id) {
    _colapsados.clear();
    for (const n of nos) if (n.eh_grupo && n.codigo) _colapsados.add(n.codigo);
    _initContrato = contexto.evento.id;
  }
  pintar(alvo, nos);
}

// orçado dos itens-folha abaixo de um grupo (pelo código)
function subtotalOrcado(nos, g) {
  if (!g.codigo) return 0;
  const pref = g.codigo + '.';
  return nos.filter(n => !n.eh_grupo && (n.codigo || '').startsWith(pref))
            .reduce((a, n) => a + Number(n.valor_orcado || 0), 0);
}
// realizado dos itens-folha abaixo de um grupo
function subtotalReal(nos, g) {
  if (!g.codigo) return 0;
  const pref = g.codigo + '.';
  return nos.filter(n => !n.eh_grupo && (n.codigo || '').startsWith(pref))
            .reduce((a, n) => a + Number(_realizado[n.id] || 0), 0);
}

function parValores(real, orc) {
  const pct = orc > 0 ? Math.round(real / orc * 100) : 0;
  const cor = orc > 0 && real > orc ? 'var(--vermelho)' : 'var(--texto)';
  return `<span style="white-space:nowrap"><span style="color:${cor}">${moeda(real)}</span>
    <span style="color:var(--texto-3)"> / ${moeda(orc)}${orc > 0 ? ` · ${pct}%` : ''}</span></span>`;
}

function pintar(alvo, nos) {
  const podeEditar = contexto.permissao?.admin || contexto.permissao?.editar_producao;
  const grandOrc = nos.filter(n => !n.eh_grupo).reduce((a, n) => a + Number(n.valor_orcado || 0), 0);
  const grandReal = Object.values(_realizado).reduce((a, v) => a + Number(v || 0), 0);

  _nos = nos;
  const linhas = nos.filter(n => !ocultoPorColapso(n)).map(n => {
    const ind = (n.nivel || 0) * 18;
    const cod = n.codigo ? `<span style="color:var(--texto-3);font-weight:500">${esc(n.codigo)}</span> ` : '';
    if (n.eh_grupo) {
      const aberto = !_colapsados.has(n.codigo);
      const chev = `<span style="display:inline-block;width:15px;color:var(--texto-3)">${aberto ? '▾' : '▸'}</span>`;
      const lapis = podeEditar ? `<button type="button" class="cl-edit botao-icone" data-id="${esc(n.id)}" title="Editar grupo" style="font-size:13px;opacity:.6">&#9998;</button>` : '';
      return `<div class="cl-grupo" data-cod="${esc(n.codigo || '')}" style="padding:8px;margin-left:${ind}px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-weight:600;border-top:1px solid var(--borda);cursor:pointer">
        <span style="min-width:0">${chev}${cod}${esc(n.nome)}</span>
        <span style="display:flex;align-items:center;gap:8px;white-space:nowrap">${lapis}${parValores(subtotalReal(nos, n), subtotalOrcado(nos, n))}</span></div>`;
    }
    const q = n.qtde ? ` <span style="color:var(--texto-3);font-size:12px">· qtde ${numero(n.qtde)}</span>` : '';
    return `<div class="cl-item" data-id="${esc(n.id)}" style="padding:6px 8px;margin-left:${ind + 15}px;display:flex;justify-content:space-between;gap:10px;cursor:pointer">
      <span style="min-width:0">${cod}${esc(n.nome)}${q}</span>${parValores(Number(_realizado[n.id] || 0), Number(n.valor_orcado || 0))}</div>`;
  }).join('');

  alvo.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <div>
        <div class="rotulo">Realizado / Orçado do contrato</div>
        <div style="font-size:20px;font-weight:700">${moeda(grandReal)} <span style="color:var(--texto-3);font-size:15px;font-weight:500">/ ${moeda(grandOrc)}</span></div>
      </div>
      ${podeEditar ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="file" id="cl-arquivo" accept=".xlsx,.xls" style="display:none">
        <button class="botao" id="cl-importar">Importar planilha</button>
        <button class="botao" id="cl-novo">Adicionar linha</button>
      </div>` : ''}
    </div>
    ${nos.length ? `<div class="cartao" style="padding:2px">${linhas}</div>
      <div class="dica" style="margin-top:8px">Clique num <b>item</b> para ver o detalhe e lançar despesas; num <b>grupo</b> para recolher/expandir (lápis edita).</div>` : `
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
  alvo.querySelectorAll('.cl-grupo').forEach(el => el.addEventListener('click', () => {
    const cod = el.dataset.cod;
    if (!cod) return;
    if (_colapsados.has(cod)) _colapsados.delete(cod); else _colapsados.add(cod);
    pintar(alvo, _nos);
  }));
  alvo.querySelectorAll('.cl-edit').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    const no = _nos.find(n => String(n.id) === el.dataset.id);
    if (no) modalNo(no);
  }));
  alvo.querySelectorAll('.cl-item').forEach(el => el.addEventListener('click', () => {
    const no = _nos.find(n => String(n.id) === el.dataset.id);
    if (no) detalheRubrica(no);
  }));
}

/* ── importação da planilha (Quadro Analítico) ────────── */

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

/* ── editar/adicionar um nó (estrutura) ────────────────── */

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

/* ── detalhe da rubrica: orçado × realizado + lançamentos ─ */

async function detalheRubrica(no) {
  let lancs = [];
  try { lancs = await listarLancamentos(contexto.evento.id, no.id); }
  catch (e) { return aviso(e.message, 'erro'); }
  const real = lancs.reduce((a, l) => a + Number(l.valor || 0), 0);
  const orc = Number(no.valor_orcado || 0);
  const pct = orc > 0 ? Math.round(real / orc * 100) : 0;
  const podeEditar = contexto.permissao?.admin || contexto.permissao?.editar_producao;

  abrirModal(`${no.codigo ? no.codigo + ' · ' : ''}${esc(no.nome)}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="metrica">
        <div class="rotulo">Orçado${no.qtde ? ` · qtde ${numero(no.qtde)}` : ''}</div>
        <div class="valor" style="font-size:16px">${moeda(orc)}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">Realizado${orc > 0 ? ` · ${pct}%` : ''}</div>
        <div class="valor" style="font-size:16px;color:${orc > 0 && real > orc ? 'var(--vermelho)' : 'var(--verde)'}">${moeda(real)}</div>
      </div>
    </div>
    ${podeEditar ? `<button class="botao botao-primario" id="rb-novo" style="margin-bottom:12px">Adicionar lançamento</button>` : ''}
    ${lancs.length ? `<div style="display:flex;flex-direction:column;gap:6px">
      ${lancs.map(l => `<div class="rb-lanc" data-id="${esc(l.id)}" style="display:flex;justify-content:space-between;gap:10px;padding:9px 10px;cursor:pointer;background:var(--superficie-2);border-radius:8px">
        <span>${esc(l.fornecedor?.nome || l.descricao || 'Lançamento')}${l.data_pagamento ? ` <span style="color:var(--texto-3);font-size:12px">· ${dataBR(l.data_pagamento)}</span>` : ''}</span>
        <span style="white-space:nowrap">${moeda(l.valor)}</span></div>`).join('')}
    </div>` : `<div class="dica">Nenhum lançamento nesta rubrica ainda.</div>`}
    <div class="modal-acoes" style="margin-top:14px">
      ${podeEditar ? `<button type="button" class="botao" id="rb-editar" style="margin-right:auto">Editar rubrica</button>` : ''}
      <button type="button" class="botao" id="rb-fechar">Fechar</button>
    </div>`);

  const q = s => document.querySelector(s);
  q('#rb-fechar').addEventListener('click', () => { fecharModal(); recarregar(); });
  q('#rb-editar')?.addEventListener('click', () => modalNo(no));
  q('#rb-novo')?.addEventListener('click', () => modalLancamento(no, null));
  document.querySelectorAll('.rb-lanc').forEach(el =>
    el.addEventListener('click', () => {
      const l = lancs.find(x => String(x.id) === el.dataset.id);
      if (l) modalLancamento(no, l);
    }));
}

/* ── lançamento manual (nota entra depois, lendo o arquivo) ─ */

async function modalLancamento(no, lanc) {
  const ed = !!lanc;
  const l = lanc || {};
  if (!_forns) { try { _forns = await listarFornecedores(empresaAtual()?.id); } catch (_) { _forns = []; } }
  let cotExist = [];
  if (ed) { try { cotExist = await listarCotacoesLanc(l.id); } catch (_) { cotExist = []; } }
  const cotLin = [0, 1, 2].map(n => cotExist[n] || {});
  let cotEscolhida = cotExist.findIndex(c => c.escolhida);
  if (cotEscolhida < 0) cotEscolhida = null;
  const temCot = cotExist.length > 0;
  const FORMAS = ['Boleto', 'Pix', 'Transferência', 'Dinheiro', 'Cartão', 'Outro'];

  abrirModal(ed ? 'Editar lançamento' : 'Novo lançamento', `
    <form id="flan">
      <div class="campo">
        <label for="l-forn">Fornecedor</label>
        <input class="controle" id="l-forn" list="l-forns" value="${esc(l.fornecedor?.nome || '')}" placeholder="Nome do fornecedor">
        <datalist id="l-forns">${_forns.map(f => `<option value="${esc(f.nome)}"></option>`).join('')}</datalist>
      </div>
      <div class="campo">
        <label for="l-desc">Descrição</label>
        <input class="controle" id="l-desc" value="${esc(l.descricao || '')}" placeholder="Ex.: Nota fiscal nº...">
      </div>
      <div class="linha linha-2">
        <div class="campo">
          <label for="l-valor">Valor</label>
          <input class="controle" id="l-valor" data-moeda value="${l.valor ?? ''}" required>
        </div>
        <div class="campo">
          <label for="l-emis">Data de emissão</label>
          <input class="controle" type="date" id="l-emis" value="${esc((l.data_competencia || '').slice(0, 10))}">
        </div>
      </div>
      <div class="linha linha-2">
        <div class="campo">
          <label for="l-pgto">Data de pagamento</label>
          <input class="controle" type="date" id="l-pgto" value="${esc((l.data_pagamento || '').slice(0, 10))}">
        </div>
        <div class="campo">
          <label for="l-forma">Forma de pagamento</label>
          <select class="controle" id="l-forma"><option value="">—</option>${FORMAS.map(f => `<option ${l.forma_pagamento === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
        </div>
      </div>
      <div class="campo">
        <label for="l-doc">Nº do documento / nota</label>
        <input class="controle" id="l-doc" value="${esc(l.documento_numero || '')}">
      </div>

      <details class="calculadora" ${temCot ? 'open' : ''}>
        <summary>Cotações (3 orçamentos)</summary>
        <datalist id="lc-forns">${_forns.map(f => `<option value="${esc(f.nome)}"></option>`).join('')}</datalist>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
          ${cotLin.map((c, n) => `
            <div class="lc-cot" data-linha="${n}" style="display:grid;grid-template-columns:minmax(0,1.2fr) 100px minmax(0,1fr) auto;gap:8px;align-items:center">
              <input class="controle lc-forn" list="lc-forns" placeholder="Fornecedor ${n + 1}" value="${esc(c.fornecedor_nome || '')}">
              <input class="controle lc-valor" data-moeda placeholder="0,00" value="${c.valor ?? ''}">
              <input class="controle lc-obs" placeholder="Obs" value="${esc(c.observacao || '')}">
              <button type="button" class="botao lc-sel ${cotEscolhida === n ? 'botao-primario' : ''}" data-sel="${n}">${cotEscolhida === n ? '✓ Vencedora' : 'Escolher'}</button>
            </div>`).join('')}
        </div>
        <div class="dica">A cotação escolhida preenche o fornecedor e o valor acima.</div>
      </details>

      <div class="campo">
        <label for="l-obs">Observações</label>
        <textarea class="controle" id="l-obs">${esc(l.observacoes || '')}</textarea>
      </div>
      ${ed
        ? `<div id="lan-docs" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--borda)"></div>`
        : `<div class="dica" style="margin-top:10px">Salve para anexar os documentos (nota, CNDs, comprovante, capa…).</div>`}
      <div class="modal-acoes">
        ${ed ? `<button type="button" class="botao botao-perigo" id="l-apagar" style="margin-right:auto">Apagar</button>` : ''}
        <button type="button" class="botao" id="l-cancelar">Cancelar</button>
        <button type="submit" class="botao botao-primario" id="l-salvar">${ed ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`);

  aplicarMascaraMoeda();
  const q = s => document.querySelector(s);

  if (ed && q('#lan-docs')) {
    montarAnexos('#lan-docs', {
      podeGerir: true,
      carregar: () => documentosDoLancamento(l.id),
      anexar: ({ arquivo, categoria }) => anexarDocumento({ evento_id: contexto.evento.id, lancamento_id: l.id, categoria, arquivo }),
      apagar: (id, caminho) => apagarDocumento(id, caminho),
      abrir: (caminho) => linkDocumento(caminho),
    });
  }

  // cotações: escolher vencedora preenche fornecedor + valor
  let escolhida = cotEscolhida;
  document.querySelectorAll('.lc-sel').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = Number(btn.dataset.sel);
      escolhida = (escolhida === n) ? null : n;
      document.querySelectorAll('.lc-sel').forEach(b => {
        const sel = Number(b.dataset.sel) === escolhida;
        b.classList.toggle('botao-primario', sel);
        b.textContent = sel ? '✓ Vencedora' : 'Escolher';
      });
      if (escolhida != null) {
        const linha = document.querySelector(`.lc-cot[data-linha="${escolhida}"]`);
        const nome = linha.querySelector('.lc-forn').value.trim();
        const v = lerMoeda(linha.querySelector('.lc-valor'));
        if (nome) q('#l-forn').value = nome;
        if (v) { q('#l-valor').value = v.toFixed(2); q('#l-valor').dispatchEvent(new Event('input')); }
      }
    });
  });

  q('#l-cancelar').addEventListener('click', () => detalheRubrica(no));
  q('#l-apagar')?.addEventListener('click', async () => {
    if (!confirm('Apagar este lançamento?')) return;
    try { await apagarLancamento(l.id); aviso('Removido.'); detalheRubrica(no); }
    catch (e) { aviso(e.message, 'erro'); }
  });
  q('#flan').addEventListener('submit', async e => {
    e.preventDefault();
    const valor = lerMoeda(q('#l-valor'));
    if (!valor) return aviso('Informe o valor.', 'aviso');
    await comBotao(q('#l-salvar'), async () => {
      try {
        const salvo = await salvarLancamento(contexto.evento.id, l.id || null, {
          classificacao_id: no.id, tipo: 'despesa',
          fornecedor_nome: q('#l-forn').value, descricao: q('#l-desc').value,
          valor, data_competencia: q('#l-emis').value || null, data_pagamento: q('#l-pgto').value || null,
          forma_pagamento: q('#l-forma').value || null, documento_numero: q('#l-doc').value,
          observacoes: q('#l-obs').value,
        });
        const cot = [...document.querySelectorAll('.lc-cot')].map(li => {
          const v = lerMoeda(li.querySelector('.lc-valor'));
          return { fornecedor_nome: li.querySelector('.lc-forn').value, valor: v ? v : '', observacao: li.querySelector('.lc-obs').value };
        });
        try { await salvarCotacoesLanc(empresaAtual().id, salvo.id, cot, escolhida); }
        catch (err) { aviso('Lançamento salvo, mas as cotações falharam: ' + err.message, 'aviso', 8000); }
        aviso(ed ? 'Salvo.' : 'Lançamento adicionado.');
        detalheRubrica(no);
      } catch (err) { aviso(err.message, 'erro'); }
    });
  });
}
