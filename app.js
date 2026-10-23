// ═══════════════════════════════════════════════════════
// Facility — inicialização e estrutura
// ═══════════════════════════════════════════════════════

import { bd, sessao, carregarSessao, sair, salvarPerfil, empresaAtual } from './nucleo.js';
import { APP } from './config.js';
import {
  esc, aviso, iniciarModal, abrirModal, fecharModal, comBotao,
  iniciais, aplicarTema, temaAtual, alternarTema, 
  alternarPrivado, privadoAtivo, registrarView
} from './ui.js';
import { telaLogin } from './login.js';
import { telaEventos } from './eventos.js';
import { telaPainelEmpresa } from './painel_empresa.js';
import { telaUsuarios } from './usuarios.js';
import { telaFornecedores } from './fornecedores.js';
import { telaFuncionarios } from './funcionarios.js';
import { telaProdutora } from './produtora.js';
import { telaPagamentos } from './pagamentos.js';
import { telaDocumentos } from './documentos.js';

aplicarTema(temaAtual());
iniciarModal();

/* ── partida ───────────────────────────────────────── */

function passo(texto) {
  const el = document.getElementById('carregando-texto');
  if (el) el.textContent = texto;
}

async function iniciar() {
  // Chegada pelo link de recuperação de senha
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.get('type') === 'recovery') {
    return telaLogin(entrarNoSistema, 'nova-senha');
  }

  try {
    passo('Verificando sua sessão...');
    const usuario = await carregarSessao();
    if (!usuario) return telaLogin(entrarNoSistema);
    passo('Carregando seus dados...');
    await montarEstrutura();
  } catch (e) {
    console.error(e);
    // Sessão inválida ou perfil ausente não é motivo para travar:
    // devolve para o login, que é a ação útil.
    if (String(e.message || '').match(/jwt|session|token|not authenticated/i)) {
      return telaLogin(entrarNoSistema);
    }
    window.BACKSTAGE_FALHA?.(
      'Consegui conectar, mas falhei ao carregar seus dados.',
      String(e.message || e)
    );
  }
}

async function entrarNoSistema() {
  await carregarSessao();
  await montarEstrutura();
}

/* ── estrutura interna ─────────────────────────────── */

// Menu lateral: Contratos · Painel · Cadastro (recolhível) · Financeiro · Documentos
const MENU = [
  { s: { id: 'eventos', rotulo: 'Contratos', tela: telaEventos, sempre: true } },
  { s: { id: 'painel',  rotulo: 'Painel',    tela: telaPainelEmpresa, perm: 'ver_painel' } },
  { grupo: 'Cadastro', itens: [
    { id: 'fornecedores', rotulo: 'Fornecedores', tela: telaFornecedores, perm: 'gerir_fornecedores' },
    { id: 'funcionarios', rotulo: 'Funcionários', tela: telaFuncionarios, perm: 'gerir_fornecedores' },
    { id: 'usuarios',     rotulo: 'Usuários',     tela: telaUsuarios,     perm: 'gerir_usuarios' },
    { id: 'produtora',    rotulo: 'Organização',  tela: telaProdutora,    sempre: true },
  ] },
  { s: { id: 'pagamentos', rotulo: 'Financeiro', tela: telaPagamentos,    pagador: true } },
  { s: { id: 'documentos', rotulo: 'Documentos', tela: telaDocumentos,    sempre: true } },
];
const SECOES = MENU.flatMap(b => b.grupo ? b.itens : [b.s]);

function secoesVisiveis() {
  const m = sessao.membros[0];
  const admin = m && (m.papel === 'mestre' || m.papel === 'administrador');
  // A agenda é de quem paga: administradores, ou quem tem a
  // permissão de confirmar pagamento em algum evento.
  const pagador = admin || sessao.permissoesPagamento === true;
  return SECOES.filter(s =>
    s.sempre || admin || (s.pagador && pagador) || (s.perm && m && m[s.perm]));
}

async function montarEstrutura() {
  const app = document.getElementById('app');
  const empresa = empresaAtual();
  const m = sessao.membros[0];
  const admin = m && (m.papel === 'mestre' || m.papel === 'administrador');
  const pagador = admin || sessao.permissoesPagamento === true;
  const visivel = s => s.sempre || admin || (s.pagador && pagador) || (s.perm && m && m[s.perm]);

  const navHTML = MENU.map((b, gi) => {
    if (b.grupo) {
      const itens = b.itens.filter(visivel);
      if (!itens.length) return '';
      return `<div class="nav-grupo-bloco">
        <button class="nav-grupo-btn" data-toggle-grupo="1">
          <span>${esc(b.grupo)}</span>
          <svg class="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
        <div class="nav-grupo-itens">
          ${itens.map(s => `<button class="nav-item nav-sub" data-secao="${s.id}">${esc(s.rotulo)}</button>`).join('')}
        </div>
      </div>`;
    }
    return visivel(b.s) ? `<button class="nav-item" data-secao="${b.s.id}">${esc(b.s.rotulo)}</button>` : '';
  }).join('');

  app.innerHTML = `
    <button class="btn-menu" id="btn-menu" aria-label="Abrir menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg></button>
    <div class="nav-backdrop" id="nav-backdrop" hidden></div>
    <aside class="lateral" id="lateral">
      <div class="lateral-topo">
        <div class="topo-linha">
          <span class="marca">${esc(APP.nome)}</span>
          <button id="btn-olho" class="olho-btn" aria-label="Mostrar ou ocultar valores"></button>
        </div>
        ${empresa ? `
          <span class="topo-empresa" title="Organização em que você está operando">
            ${empresa.logo_url
              ? `<img src="${esc(empresa.logo_url)}" alt="">`
              : `<span class="sigla">${esc(iniciais(empresa.nome))}</span>`}
            <span class="nome">${esc(empresa.nome)}</span>
          </span>` : ''}
      </div>
      <nav class="lateral-nav">${navHTML}</nav>
      <div class="lateral-rodape">
        <button class="avatar" id="btn-conta" aria-label="Sua conta">${esc(iniciais(sessao.usuario.nome))}</button>
        <span class="rodape-nome">${esc(sessao.usuario.nome)}</span>
        <button class="rodape-sair" id="btn-sair" title="Sair">Sair</button>
      </div>
    </aside>
    <main class="conteudo" id="conteudo"></main>
  `;
  app.hidden = false;
  document.getElementById('carregando').hidden = true;

  const fecharDrawer = () => document.body.classList.remove('menu-aberto');
  document.getElementById('btn-menu').addEventListener('click', () => document.body.classList.toggle('menu-aberto'));
  document.getElementById('nav-backdrop').addEventListener('click', fecharDrawer);

  document.getElementById('btn-conta').addEventListener('click', e => {
    e.stopPropagation();
    alternarMenuConta();
  });
  document.getElementById('btn-sair').addEventListener('click', async () => {
    await sair(); telaLogin(entrarNoSistema);
  });
  const olho = document.getElementById('btn-olho');
  const pintarOlho = () => { olho.innerHTML = iconeOlho(privadoAtivo()); };
  pintarOlho();
  olho.addEventListener('click', () => { alternarPrivado(); pintarOlho(); });

  // grupos recolhíveis do menu (Cadastro começa fechado)
  app.querySelectorAll('[data-toggle-grupo]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.nav-grupo-bloco').classList.toggle('aberto'));
  });

  app.querySelectorAll('[data-secao]').forEach(b => {
    b.addEventListener('click', () => { irPara(b.dataset.secao); fecharDrawer(); });
  });

  document.addEventListener('voltar-eventos', () => irPara('eventos'));

  document.addEventListener('produtora-alterada', () => {
    const e = empresaAtual();
    const alvo = app.querySelector('.topo-empresa .nome');
    if (alvo && e) alvo.textContent = e.nome;
  });

  const secoes = secoesVisiveis();
  await irPara(secoes[0].id);
}

async function irPara(id) {
  const secao = SECOES.find(s => s.id === id);
  if (!secao) return;
  document.querySelectorAll('[data-secao]').forEach(b =>
    b.classList.toggle('ativo', b.dataset.secao === id));
  registrarView(() => irPara(id));
  try { await secao.tela(); }
  catch (e) { aviso(e.message, 'erro'); }
}

/* ── menu da conta ─────────────────────────────────── */

function alternarMenuConta() {
  const existente = document.querySelector('.menu-conta');
  if (existente) return existente.remove();

  const menu = document.createElement('div');
  menu.className = 'menu-conta';
  menu.innerHTML = `
    <div class="info">
      <div class="nome">${esc(sessao.usuario.nome)}</div>
      <div class="email">${esc(sessao.usuario.email)}</div>
    </div>
    <div class="separador"></div>
    <button data-acao="perfil">Meus dados</button>
    <button data-acao="tema">${temaAtual() === 'escuro' ? 'Tema claro' : 'Tema escuro'}</button>
    <div class="separador"></div>
    <button data-acao="sair">Sair</button>
  `;
  document.getElementById('app').appendChild(menu);

  menu.addEventListener('click', async e => {
    const acao = e.target.dataset?.acao;
    if (!acao) return;
    menu.remove();
    if (acao === 'sair') { await sair(); telaLogin(entrarNoSistema); }
    if (acao === 'tema') alternarTema();
    if (acao === 'perfil') modalPerfil();
  });

  setTimeout(() => {
    document.addEventListener('click', function fechar(ev) {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', fechar); }
    });
  }, 0);
}

/* ── meus dados ────────────────────────────────────── */

function modalPerfil() {
  const u = sessao.usuario;
  abrirModal('Meus dados', `
    <form id="fp">
      <div class="campo">
        <label for="p-nome">Nome</label>
        <input class="controle" id="p-nome" value="${esc(u.nome)}" required>
      </div>
      <div class="linha linha-2">
        <div class="campo">
          <label for="p-cpf">CPF</label>
          <input class="controle" id="p-cpf" value="${esc(u.cpf)}" placeholder="000.000.000-00" inputmode="numeric">
        </div>
        <div class="campo">
          <label for="p-tel">WhatsApp</label>
          <input class="controle" id="p-tel" value="${esc(u.telefone)}" placeholder="71 99999-9999" inputmode="tel">
        </div>
      </div>
      <div class="campo">
        <label>Email</label>
        <input class="controle" value="${esc(u.email)}" disabled>
        <div class="dica">O email é seu acesso e não pode ser alterado por aqui</div>
      </div>
      <div class="modal-acoes">
        <button type="button" class="botao" id="p-cancelar">Cancelar</button>
        <button type="submit" class="botao botao-primario" id="p-salvar">Salvar</button>
      </div>
    </form>
  `);

  document.getElementById('p-cancelar').addEventListener('click', fecharModal);
  document.getElementById('fp').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = document.getElementById('p-nome').value.trim();
    if (!nome) return aviso('Informe seu nome.', 'aviso');

    await comBotao(document.getElementById('p-salvar'), async () => {
      try {
        await salvarPerfil({
          nome,
          cpf: document.getElementById('p-cpf').value,
          telefone: document.getElementById('p-tel').value,
        });
        document.getElementById('btn-conta').textContent = iniciais(nome);
        aviso('Dados atualizados.');
        fecharModal();
      } catch (err) { aviso(err.message, 'erro'); }
    });
  });
}

/* ── sessão expirada em outra aba ──────────────────── */

bd.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT') {
    sessao.usuario = null;
    telaLogin(entrarNoSistema);
  }
});

iniciar();
function iconeOlho(oculto) {
  const base = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
  return base + (oculto ? '<line x1="3" y1="3" x2="21" y2="21"/>' : '') + '</svg>';
}
