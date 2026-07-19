/**
 * Missão Família - Simulador de Orçamento Familiar
 * Orquestrador Principal e Controlador de Acesso (Assíncrona)
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

  const btnGoogle = document.getElementById('btn-login-google');
  const modalOnboarding = document.getElementById('modal-onboarding');
  const formOnboarding = document.getElementById('form-onboarding');

  // 1. Inicializar Supabase se as variáveis estiverem configuradas
  const isSupabaseActive = await engine.initializeSupabase();

  if (isSupabaseActive && btnGoogle) {
    btnGoogle.style.display = 'block'; // Mostra botão de login com o Google
  }

  // --- ALTERNAR ABAS DE ENTRADA (LOGIN / REGISTRO) ---
  if (btnTabLogin && btnTabRegister) {
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
      formLogin.classList.add('active'); // Oculta login
      formLogin.classList.remove('active');
    });
  }

  // --- SUBMETER LOGIN ---
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userVal = document.getElementById('login-username').value;
      const passVal = document.getElementById('login-password').value;

      const res = await engine.login(userVal, passVal);
      if (res.success) {
        if (res.isNewUser) {
          // Usuário cadastrado no Auth mas sem perfil público
          if (authContainer) authContainer.style.display = 'none';
          if (modalOnboarding) modalOnboarding.style.display = 'flex';
          return;
        }

        if (authContainer) authContainer.style.display = 'none';
        await bootstrapUserSession();
      } else {
        alert(res.message);
      }
    });
  }

  // --- SUBMETER LOGIN GOOGLE ---
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      const res = await engine.loginWithGoogle();
      if (res && !res.success) {
        alert(res.message);
      }
    });
  }

  // --- SUBMETER ONBOARDING (GOOGLE/OAUTH PRIMEIRO LOGIN) ---
  if (formOnboarding) {
    formOnboarding.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('onb-name').value;
      const clube = document.getElementById('onb-clube').value;
      const unidade = document.getElementById('onb-unidade').value;
      const age = parseInt(document.getElementById('onb-age').value);

      const res = await engine.completeProfile(name, clube, unidade, age);
      alert(res.message);
      if (res.success) {
        if (modalOnboarding) modalOnboarding.style.display = 'none';
        // Recarregar para bootstrap limpo com os novos dados
        window.location.reload();
      }
    });
  }

  // --- SUBMETER REGISTRO PARTICIPANTE ---
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value;
      const pass = document.getElementById('reg-password').value;
      const name = document.getElementById('reg-name').value;
      
      const role = 'participant'; // Registro público sempre como participante
      const clube = document.getElementById('reg-clube').value;
      const unidade = document.getElementById('reg-unidade').value;
      const age = document.getElementById('reg-age').value;

      const res = await engine.register(username, pass, role, name, clube, unidade, age, null);
      alert(res.message);
      if (res.success) {
        formRegister.reset();
        if (btnTabLogin) btnTabLogin.click();
      }
    });
  }

  // --- LOGOUT ---
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm("Deseja sair do simulador?")) {
        engine.logout();
      }
    });
  }

  // --- CONTROLES DE SIMULAÇÃO (APENAS PARA PÁGINA PARTICIPANTE QUANDO SIMULADA POR ADMIN) ---
  async function loadAdminParticipantSelector() {
    try {
      const parts = await engine.getParticipants();
      if (participantSelector) {
        participantSelector.innerHTML = parts.map(p => `<option value="${p.id}">${p.name} (${p.clube || 'N/A'})</option>`).join('');
        participantSelector.disabled = false;
        
        if (parts.length > 0) {
          let selectedId = localStorage.getItem('mf_active_part_id') || parts[0].id;
          if (!parts.some(p => p.id === selectedId)) {
            selectedId = parts[0].id;
          }
          participantSelector.value = selectedId;
          engine.currentUser.participantId = selectedId;
          localStorage.setItem('mf_active_part_id', selectedId);
          await refreshParticipantView();
        } else {
          participantSelector.innerHTML = '<option value="">Nenhum aluno cadastrado</option>';
          participantSelector.disabled = true;
        }
      }
    } catch (err) {
      console.error('Erro ao listar participantes para o administrador:', err);
    }
  }

  if (profileSelector) {
    profileSelector.addEventListener('change', async (e) => {
      const role = e.target.value;
      if (role === 'participant') {
        if (viewAdmin) viewAdmin.style.display = 'none';
        if (viewParticipant) viewParticipant.style.display = 'block';
        if (activeParticipantGroup) activeParticipantGroup.style.display = 'block';
        await loadAdminParticipantSelector();
      } else {
        if (viewAdmin) viewAdmin.style.display = 'flex';
        if (viewParticipant) viewParticipant.style.display = 'none';
        if (activeParticipantGroup) activeParticipantGroup.style.display = 'none';
        initAdminView();
        await refreshAdminTab('admin-dashboard');
      }
    });
  }

  if (participantSelector) {
    participantSelector.addEventListener('change', async (e) => {
      const pId = e.target.value;
      if (!pId) return;
      engine.currentUser.participantId = pId;
      localStorage.setItem('mf_active_part_id', pId);
      
      await refreshParticipantView();
      const activeOverlay = document.querySelector('.modal-overlay[style*="display: flex"]');
      if (activeOverlay) {
        activeOverlay.style.display = 'none';
      }
    });
  }

  // --- INICIALIZAÇÃO DA SESSÃO ---
  async function bootstrapUserSession() {
    const user = engine.currentUser;
    if (!user) return;

    // Se perfil do usuário estiver incompleto (OAuth Google)
    if (user.isNewUser) {
      if (authContainer) authContainer.style.display = 'none';
      if (modalOnboarding) modalOnboarding.style.display = 'flex';
      return;
    }

    const profileSelGroup = document.getElementById('admin-profile-selector-group');

    if (user.role === 'admin') {
      // 1. Mostrar painel do administrador por padrão
      if (viewParticipant) viewParticipant.style.display = 'none';
      if (viewAdmin) viewAdmin.style.display = 'flex';
      
      // Exibir o seletor de perfil/visão do administrador
      if (profileSelGroup) profileSelGroup.style.display = 'block';
      if (profileSelector) profileSelector.value = 'admin';
      if (activeParticipantGroup) activeParticipantGroup.style.display = 'none';

      await refreshAdminTab('admin-dashboard');
    } else {
      // 2. Mostrar ambiente do participante comum
      if (viewAdmin) viewAdmin.style.display = 'none';
      if (viewParticipant) viewParticipant.style.display = 'block';

      // Esconder seletores administrativos
      if (profileSelGroup) profileSelGroup.style.display = 'none';
      if (activeParticipantGroup) activeParticipantGroup.style.display = 'none';

      // Travar seletor no participante logado
      if (participantSelector) {
        participantSelector.innerHTML = `<option value="${pId()}">${user.name}</option>`;
        participantSelector.disabled = true;
      }

      await refreshParticipantView();
    }
  }

  function pId() {
    return engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
  }

  // --- INICIALIZAR EVENT LISTENERS DE CONTROLES E MODAIS ---
  initParticipantView();
  initAdminView();

  // --- CONTROLE DE CARGA INICIAL ---
  if (engine.isAuthenticated()) {
    const user = engine.currentUser;

    if (user.isNewUser) {
      if (authContainer) authContainer.style.display = 'none';
      if (modalOnboarding) modalOnboarding.style.display = 'flex';
      return;
    }

    if (authContainer) authContainer.style.display = 'none';
    await bootstrapUserSession();
  } else {
    if (authContainer) authContainer.style.display = 'flex';
    if (viewAdmin) viewAdmin.style.display = 'none';
    if (viewParticipant) viewParticipant.style.display = 'none';
    const adminHeaderCtrls = document.getElementById('admin-header-controls');
    if (adminHeaderCtrls) adminHeaderCtrls.style.display = 'none';
  }
});
