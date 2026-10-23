// ═══════════════════════════════════════════════════════
// Funcionários (CLT / PJ)
//
// Quadro de pessoal da organização, reaproveitado entre os
// contratos. CLT entra na folha; PJ é prestador com CNPJ.
// ═══════════════════════════════════════════════════════

import {
  sessao, listarFuncionarios, salvarFuncionario, alternarFuncionario, consultarCNPJ,
} from './nucleo.js';
import { esc, aviso, abrirModal, fecharModal, comBotao } from './ui.js';

let _empresa = null;
let _busca = '';

const TIPO = { clt: ['CLT', 'etiqueta-verde'], pj: ['PJ', 'etiqueta-acento'] };

export async function telaFuncionarios() {
  const alvo = document.querySelector('#conteudo');
  _empresa = sessao.membros[0]?.empresa;
  if (!_empresa) {
    alvo.innerHTML = `<div class="vazio"><h3>Sem organização</h3><p>Você não está vinculado a nenhuma organização.</p></div>`;
    return;
  }

  alvo.innerHTML = `<div style="padding:40px;text-align:center;color:var(--texto-2)">Carregando...</div>`;

  let lista;
  try { lista = await listarFuncionarios(_empresa.id); }
  catch (e) {
    alvo.innerHTML = `<div class="vazio"><h3>Não consegui carregar</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  const filtrada = _busca
    ? lista.filter(f => (f.nome + ' ' + (f.cpf || '') + ' ' + (f.documento || '')).toLowerCase().includes(_busca.toLowerCase()))
    : lista;

  alvo.innerHTML = `
    <div class="pagina-topo">
      <h1>Funcionários</h1>
      <div class="espaco"></div>
      <input class="controle" id="busca" placeholder="Buscar" value="${esc(_busca)}"
             style="max-width:220px;height:38px">
      <button class="botao botao-primario" id="novo">Novo funcionário</button>
    </div>

    ${filtrada.length ? `
      <div class="cartao" style="padding:0;overflow:hidden">
        ${filtrada.map(f => {
          const [rot, cls] = TIPO[f.tipo] || TIPO.clt;
          return `
          <div class="linha-lista">
            <div style="min-width:0;flex:1">
              <div style="font-weight:500;font-size:14px">
                ${esc(f.nome)}
                <span class="etiqueta ${cls}" style="margin-left:6px">${rot}</span>
                ${f.ativo ? '' : '<span class="etiqueta etiqueta-neutra" style="margin-left:6px">inativo</span>'}
              </div>
              <div style="font-size:12px;color:var(--texto-2)">
                ${[f.tipo === 'pj' ? f.documento : f.cpf, f.telefone].filter(Boolean).map(esc).join(' · ') || 'sem dados de contato'}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
              <button class="botao" style="height:32px;font-size:13px" data-editar="${esc(f.id)}">Editar</button>
              <button class="botao" style="height:32px;font-size:13px" data-alternar="${esc(f.id)}" data-ativo="${f.ativo}">
                ${f.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>` : `
      <div class="vazio">
        <h3>${_busca ? 'Nada encontrado' : 'Nenhum funcionário ainda'}</h3>
        <p>${_busca ? 'Tente outro termo.' : 'Cadastre o quadro de pessoal — CLT e prestadores PJ — para reaproveitar entre os contratos.'}</p>
        ${_busca ? '' : `<button class="botao botao-primario" id="novo2">Cadastrar funcionário</button>`}
      </div>`}
  `;

  const b = alvo.querySelector('#busca');
  b?.addEventListener('input', () => { _busca = b.value; telaFuncionarios().then(() => {
    const n = document.querySelector('#busca'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  }); });

  alvo.querySelector('#novo')?.addEventListener('click', () => modalFuncionario(null));
  alvo.querySelector('#novo2')?.addEventListener('click', () => modalFuncionario(null));
  alvo.querySelectorAll('[data-editar]').forEach(el =>
    el.addEventListener('click', () => modalFuncionario(lista.find(f => f.id === el.dataset.editar))));
  alvo.querySelectorAll('[data-alternar]').forEach(el =>
    el.addEventListener('click', async () => {
      try {
        await alternarFuncionario(el.dataset.alternar, el.dataset.ativo !== 'true');
        await telaFuncionarios();
      } catch (e) { aviso(e.message, 'erro'); }
    }));
}

function modalFuncionario(f) {
  const edicao = !!f;
  f = f || {};
  const pj = f.tipo === 'pj';
  abrirModal(edicao ? 'Editar funcionário' : 'Novo funcionário', `
    <form id="ff">
      <div class="campo">
        <label>Vínculo</label>
        <div class="segmentos" id="fn-tipo">
          <button type="button" class="seg ${pj ? '' : 'ativo'}" data-tipo="clt">CLT</button>
          <button type="button" class="seg ${pj ? 'ativo' : ''}" data-tipo="pj">PJ</button>
        </div>
      </div>
      <div class="campo">
        <label for="fn-nome">Nome ${pj ? '/ Razão social' : 'completo'}</label>
        <input class="controle" id="fn-nome" value="${esc(f.nome || '')}" required>
      </div>
      <div id="fn-bloco-pj" ${pj ? '' : 'hidden'}>
        <div class="campo">
          <label for="fn-doc">CNPJ</label>
          <div style="display:flex;gap:8px">
            <input class="controle" id="fn-doc" value="${esc(f.documento || '')}" inputmode="numeric" placeholder="Só os números">
            <button type="button" class="botao" id="fn-buscar" style="white-space:nowrap">Buscar CNPJ</button>
          </div>
          <div class="dica">Digite o CNPJ e clique em Buscar — o sistema preenche a razão social pela Receita.</div>
        </div>
      </div>
      <div class="linha linha-2">
        <div class="campo">
          <label for="fn-cpf">CPF</label>
          <input class="controle" id="fn-cpf" value="${esc(f.cpf || '')}" inputmode="numeric" placeholder="000.000.000-00">
        </div>
        <div class="campo">
          <label for="fn-tel">Telefone</label>
          <input class="controle" id="fn-tel" value="${esc(f.telefone || '')}" inputmode="tel">
        </div>
      </div>
      <div class="linha linha-2">
        <div class="campo">
          <label for="fn-banco">Banco</label>
          <input class="controle" id="fn-banco" value="${esc(f.banco || '')}">
        </div>
        <div class="campo">
          <label for="fn-ag">Agência</label>
          <input class="controle" id="fn-ag" value="${esc(f.agencia || '')}">
        </div>
      </div>
      <div class="linha linha-2">
        <div class="campo">
          <label for="fn-conta">Conta</label>
          <input class="controle" id="fn-conta" value="${esc(f.conta || '')}">
        </div>
        <div class="campo">
          <label for="fn-pix">Chave PIX</label>
          <input class="controle" id="fn-pix" value="${esc(f.chave_pix || '')}">
        </div>
      </div>
      <div class="campo">
        <label for="fn-obs">Observações</label>
        <textarea class="controle" id="fn-obs">${esc(f.observacoes || '')}</textarea>
      </div>
      <div class="modal-acoes">
        <button type="button" class="botao" id="fn-cancelar">Cancelar</button>
        <button type="submit" class="botao botao-primario" id="fn-salvar">${edicao ? 'Salvar' : 'Cadastrar'}</button>
      </div>
    </form>
  `);

  const q = s => document.querySelector(s);
  let tipo = pj ? 'pj' : 'clt';

  q('#fn-tipo').querySelectorAll('.seg').forEach(btn => {
    btn.addEventListener('click', () => {
      tipo = btn.dataset.tipo;
      q('#fn-tipo').querySelectorAll('.seg').forEach(b => b.classList.toggle('ativo', b.dataset.tipo === tipo));
      q('#fn-bloco-pj').hidden = tipo !== 'pj';
    });
  });

  q('#fn-cancelar').addEventListener('click', fecharModal);
  q('#fn-buscar')?.addEventListener('click', async () => {
    await comBotao(q('#fn-buscar'), async () => {
      try {
        const d = await consultarCNPJ(q('#fn-doc').value);
        if (d.razao_social && !q('#fn-nome').value.trim()) q('#fn-nome').value = d.razao_social;
        if (d.telefone && !q('#fn-tel').value.trim()) q('#fn-tel').value = d.telefone;
        aviso('Dados preenchidos pela Receita.');
      } catch (err) { aviso(err.message, 'erro'); }
    });
  });
  q('#ff').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = q('#fn-nome').value.trim();
    if (!nome) return aviso('Informe o nome.', 'aviso');
    await comBotao(q('#fn-salvar'), async () => {
      try {
        await salvarFuncionario(_empresa.id, f.id || null, {
          nome, tipo,
          cpf: q('#fn-cpf').value, documento: q('#fn-doc')?.value,
          telefone: q('#fn-tel').value, banco: q('#fn-banco').value,
          agencia: q('#fn-ag').value, conta: q('#fn-conta').value,
          chave_pix: q('#fn-pix').value, observacoes: q('#fn-obs').value,
        });
        aviso(f.id ? 'Funcionário atualizado.' : 'Funcionário cadastrado.');
        fecharModal();
        await telaFuncionarios();
      } catch (err) { aviso(err.message, 'erro'); }
    });
  });
}
