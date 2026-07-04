/**
 * Missão Família - Simulador de Orçamento Familiar
 * Orquestrador Principal e Controlador de Acesso (Assíncrono)
 */

import { engine } from './state.js';
import { initAdminView, refreshAdminTab } from './admin.js';
import { initParticipantView, refreshParticipantView } from './participant.js';

document.addEventListener('DOMContentLoaded', async () => {
  const authContainer = document.getElementById('auth-container');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const btnTabLogin = document.getElementById('btn-tab-login');
  const btnTabRegister = document.getElementById('btn-tab-register');
  const regRoleSelect = document.getElementById('reg-role');
  const regPartFields = document.getElementById('reg-participant-fields');
  const regAdminFields = document.getElementById('reg-admin-fields');

  const profileSelector = document.getElementById('profile-selector');
  const participantSelector = document.getElementById('participant-selector');
  const adminProfileGroup = document.getElementById('admin-profile-selector-group');
  const activeParticipantGroup = document.getElementById('active-participant-group');
  const btnReset = document.getElementById('btn-reset-simulator');
  const btnLogout = document.getElementById('btn-logout');

  const viewAdmin = document.getElementById('view-admin');
  const viewParticipant = document.getElementById('view-participant');

  // --- ALTERNAR ABAS DE ENTRADA (LOGIN / REGISTRO) ---
  btnTabLogin.addEventListener('click', () => {
    btnTabLogin.classList.add('active');
    btnTabRegister.classList.remove('active');
    formLogin.classList.add('active');
    formRegister.classList.remove('active');
  });

  btnTabRegister.addEventListener('click', () => {
    btnTabRegister.classList.add('active');
    btnTabLogin.classList.remove('active');
    formRegister.classList.add('active');
    formLogin.classList.remove('active');
  });

  // Mostrar campos condicionais com base no papel selecionado
  regRoleSelect.addEventListener('change', (e) => {
    if (e.target.value === 'admin') {
      regPartFields.style.display = 'none';
      regAdminFields.style.display = 'block';
    } else {
      regPartFields.style.display = 'block';
      regAdminFields.style.display = 'none';
    }
  });

  // --- SUBMETER LOGIN ---
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userVal = document.getElementById('login-username').value;
    const passVal = document.getElementById('login-password').value;

    const res = await engine.login(userVal, passVal);
    if (res.success) {
      authContainer.style.display = 'none';
      await bootstrapUserSession();
    } else {
      alert(res.message);
    }
  });

  // --- SUBMETER REGISTRO ---
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const pass = document.getElementById('reg-password').value;
    const name = document.getElementById('reg-name').value;
    const role = regRoleSelect.value;
    
    let clube = null, unidade = null, age = null, adminCode = null;

    if (role === 'admin') {
      adminCode = document.getElementById('reg-admin-code').value;
    } else {
      clube = document.getElementById('reg-clube').value;
      unidade = document.getElementById('reg-unidade').value;
      age = document.getElementById('reg-age').value;
    }

    const res = await engine.register(username, pass, role, name, clube, unidade, age, adminCode);
    alert(res.message);
    if (res.success) {
      formRegister.reset();
      btnTabLogin.click(); // Volta para tela de login
    }
  });

  // --- LOGOUT ---
  btnLogout.addEventListener('click', () => {
    if (confirm("Deseja sair do simulador?")) {
      engine.logout();
    }
  });

  // --- CONTROLES DO HEADER ---

  // Admin altera o perfil sendo visualizado
  profileSelector.addEventListener('change', async (e) => {
    const role = e.target.value;
    if (role === 'admin') {
      viewAdmin.style.display = 'block';
      viewParticipant.style.display = 'none';
      activeParticipantGroup.style.display = 'none';
      
      const activeTabBtn = document.querySelector('.admin-nav-btn.active');
      if (activeTabBtn) {
        await refreshAdminTab(activeTabBtn.getAttribute('data-tab'));
      }
    } else if (role === 'participant') {
      viewAdmin.style.display = 'none';
      viewParticipant.style.display = 'block';
      activeParticipantGroup.style.display = 'block';
      
      // Sincroniza participante
      const selectedId = participantSelector.value;
      if (selectedId) {
        engine.state.activeParticipantId = selectedId;
      }
      await refreshParticipantView();
    }
  });

  // Troca de Participante ativo (Apenas para admin)
  participantSelector.addEventListener('change', async (e) => {
    const pId = e.target.value;
    engine.state.activeParticipantId = pId;
    localStorage.setItem('mf_active_part_id', pId);
    
    await refreshParticipantView();
    const activeOverlay = document.querySelector('.modal-overlay[style*="display: flex"]');
    if (activeOverlay) {
      activeOverlay.style.display = 'none'; // Fecha modais abertos ao trocar de jogador
    }
  });

  // Resetar (Apenas Admin)
  btnReset.addEventListener('click', () => {
    if (confirm("ATENÇÃO: A limpeza total de dados exige acesso ao banco e não é permitida diretamente pelo cliente por segurança. Limpe no Supabase/JSON se necessário.")) {
      // Sem re-seeding direto do front por segurança
    }
  });

  // --- INICIALIZAÇÃO DA SESSÃO ---

  async function bootstrapUserSession() {
    const user = engine.currentUser;
    if (!user) return;

    // Inicializa Views do JS
    initAdminView();
    initParticipantView();

    if (user.role === 'admin') {
      // Diretor: Mostrar menu administrativo e liberar alteração de perfis
      viewAdmin.style.display = 'block';
      viewParticipant.style.display = 'none';
      adminProfileGroup.style.display = 'block';
      activeParticipantGroup.style.display = 'none';
      
      // Liberar reset de testes local
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        btnReset.style.display = 'inline-block';
      }

      await updateParticipantSelectors();
      await refreshAdminTab('admin-dashboard');
    } else {
      // Aluno/Participante: Travar a visualização apenas na sua própria casa e ocultar ferramentas de admin
      viewAdmin.style.display = 'none';
      viewParticipant.style.display = 'block';
      adminProfileGroup.style.display = 'none';
      activeParticipantGroup.style.display = 'block';
      btnReset.style.display = 'none';

      // Travar seletor no participante ativo
      participantSelector.innerHTML = `<option value="${engine.activeParticipantId}">${user.name}</option>`;
      participantSelector.disabled = true;

      await refreshParticipantView();
    }
  }

  // Atualizar seletores de alunos no painel de admin
  async function updateParticipantSelectors() {
    try {
      const list = await engine.getParticipants();
      participantSelector.innerHTML = '';
      participantSelector.disabled = false;

      if (list.length === 0) {
        participantSelector.innerHTML = '<option value="">Nenhum aluno cadastrado</option>';
        return;
      }

      list.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.unidade})`;
        participantSelector.appendChild(opt);
      });

      if (engine.activeParticipantId && list.some(x => x.id === engine.activeParticipantId)) {
        participantSelector.value = engine.activeParticipantId;
      } else if (list.length > 0) {
        participantSelector.value = list[0].id;
        engine.state.activeParticipantId = list[0].id;
      }
    } catch (err) {
      console.error(err);
    }
  }

  window.updateParticipantSelectors = updateParticipantSelectors;

  // --- CONTROLE DE CARGA INICIAL ---
  if (engine.isAuthenticated()) {
    authContainer.style.display = 'none';
    await bootstrapUserSession();
  } else {
    authContainer.style.display = 'flex';
    viewAdmin.style.display = 'none';
    viewParticipant.style.display = 'none';
  }
});
