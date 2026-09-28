// ═══════════════════════════════════════════════════════
// Contratos — lista por organização e cadastro
// ═══════════════════════════════════════════════════════

import {
  sessao, listarEventos, criarEvento, atualizarEvento, buscarEvento,
  empresasOndeCrio, souAdmin, enviarLogo, comprimirImagem,
  listarFontes, criarFontes,
} from './nucleo.js';
import {
  esc, aviso, abrirModal, fecharModal, comBotao,
  periodo, numero, iniciais, SITUACAO_EVENTO,
} from './ui.js';
import { telaEvento } from './evento.js';

const FONTES_SUGERIDAS = ['Convênio', 'Edital', 'Contrato de gestão', 'Recurso próprio', 'Doação'];

export async function telaEventos() {
  const app = document.getElementById('app');
  const alvo = app.querySelector('#conteudo');
  alvo.innerHTML = `<div style="padding:40px;text-align:center;color:var(--texto-2)">Carregando contratos...</div>`;

  let eventos;
  try {
    eventos = await listarEventos();
  } catch (e) {
    alvo.innerHTML = `<div class="vazio"><h3>Não consegui carregar</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  const podeCriar = empresasOndeCrio().length > 0;

  if (!eventos.length) {
    alvo.innerHTML = `
      <div class="pagina-topo"><h1>Contratos</h1></div>
      <div class="vazio">
        <h3>Nenhum contrato ainda</h3>
        <p>${podeCriar
            ? 'Comece cadastrando o primeiro contrato da organização.'
            : 'Você ainda não recebeu acesso a nenhum contrato.'}</p>
        ${podeCriar ? `<button class="botao botao-primario" id="novo">Cadastrar contrato</button>` : ''}
      </div>`;
    alvo.querySelector('#novo')?.addEventListener('click', () => modalEvento(null, telaEventos));
    return;
  }

  // Agrupa por organização — uma pessoa pode atender mais de uma
  const grupos = new Map();
  for (const ev of eventos) {
    const chave = ev.empresa?.id || 'sem';
    if (!grupos.has(chave)) grupos.set(chave, { empresa: ev.empresa, eventos: [] });
    grupos.get(chave).eventos.push(ev);
  }

  alvo.innerHTML = `
    <div class="pagina-topo">
      <h1>Contratos</h1>
      <div class="espaco"></div>
      ${podeCriar ? `<button class="botao botao-primario" id="novo">Novo contrato</button>` : ''}
    </div>
    ${[...grupos.values()].map(g => grupoHTML(g, true)).join('')}
  `;

  alvo.querySelector('#novo')?.addEventListener('click', () => modalEvento(null, telaEventos));
  alvo.querySelectorAll('[data-evento]').forEach(el => {
    el.addEventListener('click', () => telaEvento(el.dataset.evento));
  });
  alvo.querySelectorAll('[data-config]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      modalEvento(el.dataset.config, telaEventos);
    });
  });
}

function grupoHTML(g, mostrarCabeca) {
  const emp = g.empresa || { nome: 'Sem organização' };
  return `
    <div class="grupo-empresa">
      ${mostrarCabeca ? `
        <div class="cabeca">
          ${emp.logo_url
            ? `<img class="logo" src="${esc(emp.logo_url)}" alt="">`
            : `<div class="logo"></div>`}
          <h2>${esc(emp.nome)}</h2>
        </div>` : ''}
      <div class="eventos-grade">
        ${g.eventos.map(cartaoHTML).join('')}
      </div>
    </div>`;
}

function cartaoHTML(ev) {
  const sit = SITUACAO_EVENTO[ev.situacao] || SITUACAO_EVENTO.planejamento;
  return `
    <button class="evento-cartao" data-evento="${esc(ev.id)}">
      ${ev.logo_url
        ? `<img class="evento-logo" src="${esc(ev.logo_url)}" alt="">`
        : `<div class="evento-logo-vazio">${esc(iniciais(ev.nome))}</div>`}
      <div class="evento-corpo">
        <div class="nome">${esc(ev.nome)}</div>
        <div class="meta">${esc(periodo(ev.data_inicio, ev.data_fim))}</div>
        ${ev.cidade ? `<div class="meta">${esc(ev.cidade)}</div>` : ''}
        <div class="rodape">
          <span class="etiqueta ${sit.classe}">${sit.rotulo}</span>
          ${ev.publico_estimado
            ? `<span style="font-size:12px;color:var(--texto-3)">${numero(ev.publico_estimado)} pessoas</span>`
            : ''}
          <span style="flex:1"></span>
          <span class="botao-icone" data-config="${esc(ev.id)}" title="Editar dados do contrato">&#9881;</span>
        </div>
      </div>
    </button>`;
}

/* ── cadastro e edição ─────────────────────────────── */

async function modalEvento(id, aoSalvar) {
  const edicao = !!id;
  let ev = {};
  let fontes = [];

  if (edicao) {
    try {
      ev = await buscarEvento(id);
      fontes = await listarFontes(id);
    } catch (e) { return aviso(e.message, 'erro'); }
  }

  const empresas = edicao ? [] : empresasOndeCrio();
  if (!edicao && !empresas.length) return aviso('Você não pode criar contratos.', 'erro');

  const podeEditar = edicao ? souAdmin(ev.empresa?.id) : true;

  abrirModal(edicao ? ev.nome : 'Novo contrato', `
    <form id="fev">
      ${!edicao && empresas.length > 1 ? `
        <div class="campo">
          <label for="ev-empresa">Organização</label>
          <select class="controle" id="ev-empresa">
            ${empresas.map(e => `<option value="${esc(e.id)}">${esc(e.nome)}</option>`).join('')}
          </select>
        </div>` : ''}

      <div class="campo">
        <label for="ev-nome">Nome do contrato</label>
        <input class="controle" id="ev-nome" value="${esc(ev.nome || '')}"
               placeholder="Nome ou número do contrato" ${podeEditar ? '' : 'disabled'} required>
      </div>

      <div class="campo">
        <label>Logo do contrato</label>
        <div class="envio-logo">
          <img class="previa" id="ev-previa" alt=""
               src="${esc(ev.logo_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E')}">
          <div>
            <button type="button" class="botao" id="ev-escolher" ${podeEditar ? '' : 'disabled'}>Escolher imagem</button>
            <input type="file" id="ev-arquivo" accept="image/*">
            <div class="dica">Aparece na lista e no cabeçalho dos relatórios</div>
          </div>
        </div>
      </div>

      <div class="linha linha-2">
        <div class="campo">
          <label for="ev-inicio">Início</label>
          <input class="controle" type="date" id="ev-inicio"
                 value="${esc((ev.data_inicio || '').slice(0,10))}" ${podeEditar ? '' : 'disabled'}>
        </div>
        <div class="campo">
          <label for="ev-fim">Término</label>
          <input class="controle" type="date" id="ev-fim"
                 value="${esc((ev.data_fim || '').slice(0,10))}" ${podeEditar ? '' : 'disabled'}>
        </div>
      </div>

      <div class="linha linha-2">
        <div class="campo">
          <label for="ev-cidade">Cidade</label>
          <input class="controle" id="ev-cidade" value="${esc(ev.cidade || '')}"
                 placeholder="" ${podeEditar ? '' : 'disabled'}>
        </div>
        <div class="campo">
          <label for="ev-publico">Público estimado</label>
          <input class="controle" type="number" min="0" id="ev-publico"
                 value="${esc(ev.publico_estimado ?? '')}" placeholder="" ${podeEditar ? '' : 'disabled'}>
        </div>
      </div>

      <div class="campo">
        <label for="ev-local">Local</label>
        <input class="controle" id="ev-local" value="${esc(ev.local || '')}"
               placeholder="" ${podeEditar ? '' : 'disabled'}>
      </div>

      ${edicao ? `
        <div class="campo">
          <label for="ev-situacao">Situação</label>
          <select class="controle" id="ev-situacao" ${podeEditar ? '' : 'disabled'}>
            ${Object.entries(SITUACAO_EVENTO).map(([v, s]) =>
              `<option value="${v}" ${ev.situacao === v ? 'selected' : ''}>${s.rotulo}</option>`).join('')}
          </select>
        </div>` : `
        <div class="campo">
          <label>Fontes de recurso</label>
          <div style="display:flex;gap:8px">
            <input class="controle" id="ev-fonte-nova" list="ev-fontes-sugeridas"
                   placeholder="Ex.: Convênio, Edital, Contrato de gestão">
            <button type="button" class="botao" id="ev-fonte-add">Adicionar</button>
          </div>
          <datalist id="ev-fontes-sugeridas">
            ${FONTES_SUGERIDAS.map(f => `<option value="${esc(f)}"></option>`).join('')}
          </datalist>
          <div id="ev-fontes" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
          <div class="dica">De onde vem o dinheiro para pagar as despesas. Adicione quantas quiser — você escolhe a fonte na hora de pagar, e pode editar essa lista depois.</div>
        </div>`}

      <div class="campo">
        <label for="ev-obs">Observações</label>
        <textarea class="controle" id="ev-obs" ${podeEditar ? '' : 'disabled'}>${esc(ev.observacoes || '')}</textarea>
      </div>

      ${edicao && fontes.length ? `
        <div class="campo">
          <label>Fontes cadastradas</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${fontes.map(f => `<span class="etiqueta ${f.ativa ? 'etiqueta-neutra' : 'etiqueta-vermelha'}">${esc(f.nome)}</span>`).join('')}
          </div>
        </div>` : ''}

      ${podeEditar ? `
        <div class="modal-acoes">
          <button type="button" class="botao" id="ev-cancelar">Cancelar</button>
          <button type="submit" class="botao botao-primario" id="ev-salvar">
            ${edicao ? 'Salvar' : 'Criar contrato'}
          </button>
        </div>` : `
        <div class="modal-acoes">
          <button type="button" class="botao" id="ev-cancelar">Fechar</button>
        </div>`}
    </form>
  `);

  const q = s => document.querySelector(s);
  let arquivoLogo = null;

  // Fontes de recurso: campo aberto, com várias fontes
  const fontesNovas = [];
  function pintarFontes() {
    const box = q('#ev-fontes');
    if (!box) return;
    box.innerHTML = fontesNovas.map((f, idx) =>
      `<span class="etiqueta etiqueta-neutra" style="display:inline-flex;align-items:center;gap:6px">
         ${esc(f)}
         <button type="button" data-fonte="${idx}" aria-label="Remover ${esc(f)}"
                 style="background:none;border:none;cursor:pointer;font-size:15px;line-height:1;padding:0;color:var(--texto-2)">&times;</button>
       </span>`).join('');
    box.querySelectorAll('[data-fonte]').forEach(b =>
      b.addEventListener('click', () => { fontesNovas.splice(+b.dataset.fonte, 1); pintarFontes(); }));
  }
  function adicionarFonte() {
    const inp = q('#ev-fonte-nova');
    const v = (inp?.value || '').trim();
    if (!v) return;
    if (!fontesNovas.some(f => f.toLowerCase() === v.toLowerCase())) fontesNovas.push(v);
    inp.value = '';
    inp.focus();
    pintarFontes();
  }
  q('#ev-fonte-add')?.addEventListener('click', adicionarFonte);
  q('#ev-fonte-nova')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); adicionarFonte(); }
  });

  q('#ev-cancelar').addEventListener('click', fecharModal);

  q('#ev-escolher')?.addEventListener('click', () => q('#ev-arquivo').click());
  q('#ev-arquivo')?.addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return aviso('Escolha um arquivo de imagem.', 'erro');
    try {
      arquivoLogo = await comprimirImagem(f, 512);
      q('#ev-previa').src = URL.createObjectURL(arquivoLogo);
    } catch (err) { aviso(err.message, 'erro'); }
  });

  q('#fev').addEventListener('submit', async e => {
    e.preventDefault();
    if (!podeEditar) return;

    const nome = q('#ev-nome').value.trim();
    if (!nome) return aviso('Informe o nome do contrato.', 'aviso');

    const inicio = q('#ev-inicio').value || null;
    const fim = q('#ev-fim').value || null;
    if (inicio && fim && fim < inicio) return aviso('O término não pode ser antes do início.', 'aviso');

    await comBotao(q('#ev-salvar'), async () => {
      try {
        let logo_url = ev.logo_url;
        if (arquivoLogo) logo_url = await enviarLogo(arquivoLogo, 'evento');

        const dados = {
          nome,
          cidade: q('#ev-cidade').value,
          local: q('#ev-local').value,
          data_inicio: inicio,
          data_fim: fim,
          publico_estimado: q('#ev-publico').value,
          observacoes: q('#ev-obs').value,
          logo_url,
        };

        if (edicao) {
          dados.situacao = q('#ev-situacao').value;
          await atualizarEvento(id, dados);
          aviso('Contrato atualizado.');
        } else {
          dados.empresa_id = q('#ev-empresa')?.value || empresas[0].id;
          dados.dono_id = sessao.usuario.id;
          const novo = await criarEvento(dados);

          if (fontesNovas.length) {
            try { await criarFontes(novo.id, fontesNovas); }
            catch (err) { aviso('Contrato criado, mas as fontes falharam: ' + err.message, 'aviso'); }
          }
          aviso('Contrato criado.');
        }

        fecharModal();
        await aoSalvar();
      } catch (err) {
        aviso(err.message, 'erro');
      }
    });
  });
}
