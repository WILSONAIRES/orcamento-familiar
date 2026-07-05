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

  // Detecta se estamos fisicamente no painel do administrador (admin.html)
  const isAdminPage = window.location.pathname.includes('admin.html');

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
      formLogin.classList.remove('active');
    });
  }

  // Mostrar campos condicionais com base no papel selecionado (se houver seletor)
  if (regRoleSelect) {
    regRoleSelect.addEventListener('change', (e) => {
      if (e.target.value === 'admin') {
        if (regPartFields) regPartFields.style.display = 'none';
        if (regAdminFields) regAdminFields.style.display = 'block';
      } else {
        if (regPartFields) regPartFields.style.display = 'block';
        if (regAdminFields) regAdminFields.style.display = 'none';
      }
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
        // Validação estrita de página e papel
        if (isAdminPage && res.user.role !== 'admin') {
          alert("Acesso Negado: Esta página é restrita a administradores.");
          engine.logout();
          return;
        }

        if (!isAdminPage && res.user.role === 'admin') {
          // Redireciona o administrador logado no index.html para o admin.html
          alert("Bem-vindo, Diretor! Redirecionando para o Painel Administrativo...");
          window.location.href = 'admin.html';
          return;
        }

        if (authContainer) authContainer.style.display = 'none';
        await bootstrapUserSession();
      } else {
        alert(res.message);
      }
    });
  }

  // --- SUBMETER REGISTRO ---
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value;
      const pass = document.getElementById('reg-password').value;
      const name = document.getElementById('reg-name').value;
      
      // Papel implícito de acordo com a página atual
      const role = isAdminPage ? 'admin' : 'participant';
      
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

  // --- CONTROLES DO HEADER (APENAS PARA PÁGINA PARTICIPANTE QUANDO SIMULADA POR ADMIN) ---
  if (profileSelector) {
    profileSelector.addEventListener('change', async (e) => {
      const role = e.target.value;
      if (role === 'participant') {
        if (viewParticipant) viewParticipant.style.display = 'block';
        if (activeParticipantGroup) activeParticipantGroup.style.display = 'block';
        
        const selectedId = participantSelector.value;
        if (selectedId) {
          engine.currentUser.participantId = selectedId;
          localStorage.setItem('mf_active_part_id', selectedId);
        }
        await refreshParticipantView();
      }
    });
  }

  if (participantSelector) {
    participantSelector.addEventListener('change', async (e) => {
      const pId = e.target.value;
      engine.currentUser.participantId = pId;
      localStorage.setItem('mf_active_part_id', pId);
      
      await refreshParticipantView();
      const activeOverlay = document.querySelector('.modal-overlay[style*="display: flex"]');
      if (activeOverlay) {
        activeOverlay.style.display = 'none'; // Fecha modais abertos ao trocar de jogador
      }
    });
  }

  // --- INICIALIZAÇÃO DA SESSÃO ---

  async function bootstrapUserSession() {
    const user = engine.currentUser;
    if (!user) return;

    if (isAdminPage) {
      // 1. Cenário: Página admin.html
      if (user.role !== 'admin') {
        alert("Acesso Negado: Apenas administradores podem acessar o painel.");
        engine.logout();
        return;
      }

      if (viewAdmin) viewAdmin.style.display = 'block';
      initAdminView();
      await refreshAdminTab('admin-dashboard');
      
    } else {
      // 2. Cenário: Página index.html (Participante)
      if (user.role === 'admin') {
        // Redireciona administrador para admin.html
        window.location.href = 'admin.html';
        return;
      }

      if (viewParticipant) viewParticipant.style.display = 'block';
      initParticipantView();

      // Travar seletor no participante ativo
      if (participantSelector) {
        participantSelector.innerHTML = `<option value="${pId()}">${user.name}</option>`;
        participantSelector.disabled = true;
      }

      await refreshParticipantView();
    }
  }

  // Helper para obter o ID do participante ativo
  function pId() {
    return engine.currentUser.participantId || localStorage.getItem('mf_active_part_id');
  }

  // --- CONTROLE DE CARGA INICIAL ---
  if (engine.isAuthenticated()) {
    const user = engine.currentUser;
    
    // Verificações cruzadas de página e papel
    if (isAdminPage && user.role !== 'admin') {
      alert("Acesso Negado: Esta página é restrita a administradores.");
      engine.logout();
      return;
    }
    
    if (!isAdminPage && user.role === 'admin') {
      // Redireciona diretor no index.html para admin.html
      window.location.href = 'admin.html';
      return;
    }

    if (authContainer) authContainer.style.display = 'none';
    await bootstrapUserSession();
  } else {
    if (authContainer) authContainer.style.display = 'flex';
    if (viewAdmin) viewAdmin.style.display = 'none';
    if (viewParticipant) viewParticipant.style.display = 'none';
  }
});
