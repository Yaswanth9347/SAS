(function(){
  'use strict';

  class SettingsManager {
    constructor() {
      this.controls = {};
      this.saveBtn = null;
      this.resetBtn = null;
      this.saveStatus = null;
      this.changePwdBtn = null;
      this.passwordStatus = null;
    }

    init() {
      // Require auth
      if (!authManager.requireAuth()) return;
      navbarManager.setActivePage('settings.html');

      // Cache elements
      this.controls = {
        theme: document.getElementById('prefTheme'),
        fontSize: document.getElementById('prefFontSize'),
        highContrast: document.getElementById('prefHighContrast'),
        language: document.getElementById('prefLanguage'),
        notifEmail: document.getElementById('notifEmail'),
        notifApp: document.getElementById('notifApp'),
        notifSms: document.getElementById('notifSms'),
        privacyVisibility: document.getElementById('privacyVisibility'),
        privacyShowEmail: document.getElementById('privacyShowEmail'),
        privacyShowPhone: document.getElementById('privacyShowPhone')
      };

      this.saveBtn = document.getElementById('btnSaveSettings');
      this.resetBtn = document.getElementById('btnResetSettings');
      this.saveStatus = document.getElementById('saveStatus');
      this.changePwdBtn = document.getElementById('btnChangePassword');
      this.passwordStatus = document.getElementById('passwordStatus');

      this.bindEvents();
      this.loadPreferences();
    }

    bindEvents() {
      this.saveBtn.addEventListener('click', () => this.savePreferences());
      this.resetBtn.addEventListener('click', () => this.resetPreferences());
      // Live preview
      this.controls.theme.addEventListener('change', (e) => {
        window.applyTheme(e.target.value);
      });
      this.controls.fontSize.addEventListener('change', (e) => {
        if (typeof a11y !== 'undefined') a11y.applyFontSize(e.target.value);
      });
      this.controls.highContrast.addEventListener('change', (e) => {
        if (typeof a11y !== 'undefined') a11y.applyHighContrast(e.target.checked);
      });

      this.changePwdBtn.addEventListener('click', () => this.changePassword());
    }

    async loadPreferences() {
      try {
        const res = await api.getUserPreferences();
        const prefs = res?.data || {};
        // Default fallbacks
        const theme = prefs.theme || 'system';
        const fontSize = prefs.fontSize || 'medium';
        const highContrast = !!prefs.highContrast;
        const language = prefs.language || 'en';
        const notifications = Object.assign({ email: true, app: true, sms: false }, prefs.notifications);
        const privacy = Object.assign({ profileVisibility: 'team', showEmail: false, showPhone: false }, prefs.privacy);

        // Populate controls
        this.controls.theme.value = theme;
        this.controls.fontSize.value = fontSize;
        this.controls.highContrast.checked = highContrast;
        this.controls.language.value = language;
        this.controls.notifEmail.checked = !!notifications.email;
        this.controls.notifApp.checked = !!notifications.app;
        this.controls.notifSms.checked = !!notifications.sms;
        this.controls.privacyVisibility.value = privacy.profileVisibility;
        this.controls.privacyShowEmail.checked = !!privacy.showEmail;
        this.controls.privacyShowPhone.checked = !!privacy.showPhone;

        // Persist locally for fast theme on reload
        this.saveLocal({ theme, fontSize, highContrast, language, notifications, privacy, security: prefs.security || { twoFactorEnabled: false } });

        // Apply theme on initial load
        window.applyTheme(theme);
        if (typeof a11y !== 'undefined') {
          a11y.applyFontSize(fontSize);
          a11y.applyHighContrast(highContrast);
        }
      } catch (error) {
        console.error('Failed to load preferences', error);
        if (typeof notify !== 'undefined') notify.error('Failed to load settings');
      }
    }

    getPayload() {
      return {
        theme: this.controls.theme.value,
        fontSize: this.controls.fontSize.value,
        highContrast: this.controls.highContrast.checked,
        language: this.controls.language.value,
        notifications: {
          email: this.controls.notifEmail.checked,
          app: this.controls.notifApp.checked,
          sms: this.controls.notifSms.checked
        },
        privacy: {
          profileVisibility: this.controls.privacyVisibility.value,
          showEmail: this.controls.privacyShowEmail.checked,
          showPhone: this.controls.privacyShowPhone.checked
        }
      };
    }

    async savePreferences() {
      try {
        this.setSaveStatus('Saving...', '');
        const payload = this.getPayload();
        const res = await api.updateUserPreferences(payload);
        this.setSaveStatus('Settings saved', 'success');
        // Save local for theme persistence
        this.saveLocal(Object.assign({}, payload, res?.data ? { security: res.data.security } : {}));
      } catch (error) {
        console.error('Save preferences failed', error);
        this.setSaveStatus(error.message || 'Failed to save settings', 'error');
      }
    }

    resetPreferences() {
      this.controls.theme.value = 'system';
      this.controls.language.value = 'en';
      this.controls.fontSize.value = 'medium';
      this.controls.highContrast.checked = false;
      this.controls.notifEmail.checked = true;
      this.controls.notifApp.checked = true;
      this.controls.notifSms.checked = false;
      this.controls.privacyVisibility.value = 'team';
      this.controls.privacyShowEmail.checked = false;
      this.controls.privacyShowPhone.checked = false;
      window.applyTheme('system');
      if (typeof a11y !== 'undefined') {
        a11y.applyFontSize('medium');
        a11y.applyHighContrast(false);
      }
      this.setSaveStatus('Reset to defaults (not saved yet)', '');
    }

    setSaveStatus(msg, type) {
      if (!this.saveStatus) return;
      this.saveStatus.textContent = msg;
      this.saveStatus.className = 'status' + (type ? ' ' + type : '');
    }

    saveLocal(prefs) {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
      } catch (e) {}
    }

    async changePassword() {
      const currentPassword = document.getElementById('currentPassword').value.trim();
      const newPassword = document.getElementById('newPassword').value.trim();
      const confirmNewPasswordEl = document.getElementById('confirmNewPassword');
      const confirmNewPassword = confirmNewPasswordEl ? confirmNewPasswordEl.value.trim() : '';

      if (!currentPassword || !newPassword) {
        return this.setPasswordStatus('Please provide current and new password', 'error');
      }
      if (newPassword.length < 6) {
        return this.setPasswordStatus('New password must be at least 6 characters', 'error');
      }
      if (confirmNewPasswordEl && newPassword !== confirmNewPassword) {
        return this.setPasswordStatus('New password and confirmation do not match', 'error');
      }

      try {
        this.setPasswordStatus('Changing password...', '');
        const res = await api.changePassword({ currentPassword, newPassword });
        if (res && res.success !== false) {
          this.setPasswordStatus('Password changed successfully', 'success');
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
          if (confirmNewPasswordEl) confirmNewPasswordEl.value = '';
        } else {
          this.setPasswordStatus((res && res.message) || 'Failed to change password', 'error');
        }
      } catch (error) {
        this.setPasswordStatus(error.message || 'Failed to change password', 'error');
      }
    }

    setPasswordStatus(msg, type) {
      if (!this.passwordStatus) return;
      this.passwordStatus.textContent = msg;
      this.passwordStatus.className = 'status' + (type ? ' ' + type : '');
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SettingsManager().init());
  } else {
    new SettingsManager().init();
  }
})();
