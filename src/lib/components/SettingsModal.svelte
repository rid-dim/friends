<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { translations, type Language } from '../../i18n/translations';

  // --- Props ---
  export let accountPackage: any;
  export let language: Language;
  export let backendUrl: string;
  export let notificationStatus: string;
  export let publicIdentifiers: string[] = [];
  export let publicIdentifierLoading = false;
  export let friendRequestManager: any = null;

  // Funktionen, die aus der Eltern-Komponente gereicht werden
  export let changeLanguage: (lang: Language) => void;
  export let updateAccountPackage: (data: any) => Promise<boolean>;
  export let loadTheme: (url: string) => void;
  export let scheduleDisplayNameSave: (name: string) => void;
  export let reRequestNotificationPermission: () => Promise<void>;
  export let createPublicIdentifier: (id: string) => Promise<void>;
  export let showNotification: (msg: string) => void;

  const dispatch = createEventDispatcher();

  // --- Lokaler State ---
  let displayNameDraft = accountPackage?.username || '';
  let showAddPublicIdentifier = false;
  let newPublicIdentifier = '';

  // Reaktive Übersetzungen
  $: currentTranslations = translations[language] || {} as any;

  function closeModal() {
    dispatch('close');
  }
</script>

<div 
  class="modal-overlay" 
  on:click|self={closeModal}
  on:keydown={(e) => e.key === 'Escape' && closeModal()}
  role="dialog"
  aria-modal="true"
  aria-labelledby="settings-title"
>
  <div class="modal-content">
    <h2 id="settings-title">{currentTranslations.accountSettings}</h2>
    <button class="close-button" on:click={closeModal}>×</button>

    <div class="settings-container">
      <!-- Display Name -->
      <div class="setting-group">
        <label for="display-name">{currentTranslations.displayName}</label>
        <input
          id="display-name"
          type="text"
          placeholder={currentTranslations.chooseDisplayName}
          bind:value={displayNameDraft}
          on:input={(e) => scheduleDisplayNameSave((e.target as HTMLInputElement).value)}
        />
      </div>

      <!-- Profilbild (Datamap-Adresse) -->
      <div class="setting-group">
        <label for="profile-image">{currentTranslations.profileImage}</label>
        <input
          id="profile-image"
          type="text"
          placeholder={currentTranslations.enterDatamapAddress}
          value={accountPackage?.profileImage || ''}
          on:input={async (e) => {
            const val = (e.target as HTMLInputElement).value;
            if (accountPackage) {
              const ok = await updateAccountPackage({ ...accountPackage, profileImage: val });
              if (ok && friendRequestManager) {
                await friendRequestManager.updateProfileImage(val);
              }
              showNotification(currentTranslations.settingsUpdated || 'Settings updated');
            }
          }}
        />
        {#if accountPackage?.profileImage}
          <div class="preview">
            <img
              src={accountPackage.profileImage.startsWith('http')
                ? accountPackage.profileImage
                : backendUrl
                  ? `${backendUrl}/dweb-0/data/${accountPackage.profileImage}`
                  : `/dweb-0/data/${accountPackage.profileImage}`}
              alt="Profile"
            />
          </div>
        {/if}
      </div>

      <!-- Theme URL -->
      <div class="setting-group">
        <label for="theme-url">{currentTranslations.themeUrl}</label>
        <input
          id="theme-url"
          type="text"
          placeholder={currentTranslations.enterThemeUrl}
          value={accountPackage?.themeUrl || ''}
          on:input={async (e) => {
            const val = (e.target as HTMLInputElement).value;
            if (accountPackage) {
              const ok = await updateAccountPackage({ ...accountPackage, themeUrl: val });
              if (ok) {
                showNotification(currentTranslations.settingsUpdated || 'Settings updated');
                loadTheme(val);
              }
            }
          }}
        />
      </div>

      <!-- Sprache -->
      <div class="setting-group">
        <label for="language">{currentTranslations.language}</label>
        <select
          id="language"
          value={language}
          on:change={(e) => {
            const newLang = (e.target as HTMLSelectElement).value as Language;
            changeLanguage(newLang);
            language = newLang;
            if (accountPackage) {
              updateAccountPackage({ ...accountPackage, language: newLang }).then(() => {
                showNotification(translations[newLang]?.settingsUpdated || 'Settings updated');
              });
            }
          }}
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
          <option value="bg">Български</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="zh">中文</option>
        </select>
      </div>

      <!-- Public Identifier Management -->
      <div class="setting-group">
        <label>{currentTranslations.publicIdentifier}</label>

        {#if publicIdentifiers.length > 0}
          <ul class="public-identifiers">
            {#each publicIdentifiers as id}
              <li>{id}</li>
            {/each}
          </ul>
        {/if}

        {#if showAddPublicIdentifier}
          <div class="public-id-input">
            <input
              type="text"
              placeholder={currentTranslations.enterPublicIdentifier}
              bind:value={newPublicIdentifier}
              on:keydown={(e) => e.key === 'Enter' && createPublicIdentifier(newPublicIdentifier)}
            />
            <button class="confirm-button" on:click={() => createPublicIdentifier(newPublicIdentifier)} title="Add">✓</button>
          </div>
        {/if}

        {#if !showAddPublicIdentifier}
          <button class="add-button" on:click={() => { showAddPublicIdentifier = true; }} title="+">+</button>
        {/if}
      </div>

      <!-- Push Notifications -->
      {#if browser && 'Notification' in window}
        <div class="setting-group">
          <label>{currentTranslations.pushNotifications || 'Push-Notifications'}</label>
          <div class="notification-permission-row">
            <span class="notification-status-badge">{notificationStatus}</span>
            {#if Notification.permission !== 'granted'}
              <button class="secondary-button" on:click={reRequestNotificationPermission}>
                {currentTranslations.requestAgain}
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-buttons">
      <button class="primary-button" on:click={closeModal}>{currentTranslations.close}</button>
    </div>
  </div>
</div>

<style>
  /* Kopierte Styles (reduziert auf Modal-bezogene) */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }
  .modal-content {
    background: var(--background-color);
    padding: 2rem;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    position: relative;
  }
  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  .close-button:hover { opacity: 1; }
  .settings-container { margin: 1.5rem 0; }
  .setting-group { margin-bottom: 1.5rem; }
  .setting-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
  .setting-group input,
  .setting-group select { width: 100%; padding: 0.5rem; border: 1px solid var(--line-color); border-radius: 6px; background: var(--background-color); color: inherit; font-size: 0.9rem; }
  .preview { margin-top: 0.5rem; max-width: 100px; border-radius: 4px; overflow: hidden; }
  .preview img { width: 100%; height: auto; display: block; }
  .public-identifiers { list-style: none; padding: 0; margin: 0.5rem 0; }
  .public-identifiers li { background: var(--foreground-color2); padding: 0.5rem; border-radius: 4px; margin-bottom: 0.5rem; }
  .public-id-input { display: flex; gap: 0.5rem; }
  .public-id-input input { flex: 1; }
  .confirm-button { background: var(--notification-color); color: #fff; border: none; border-radius: 4px; padding: 0 0.75rem; cursor: pointer; }
  .add-button { background: var(--foreground-color2); border: 1px solid var(--line-color); border-radius: 50%; width: 1.75rem; height: 1.75rem; cursor: pointer; font-size: 1.2rem; margin-top: 0.25rem; }
  .add-button:hover, .confirm-button:hover { opacity: 0.8; }
  .modal-buttons { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; }
  .primary-button { padding: 0.6rem 1.2rem; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; background: var(--notification-color); color: #fff; }
  .primary-button:hover { opacity: 0.8; }
</style> 