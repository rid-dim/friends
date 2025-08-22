<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translations } from '../../i18n/translations';
  import AccountImageSrc from '../../AccountCreateImage.png';
  import WalletInfo from '../components/WalletInfo.svelte';

  const dispatch = createEventDispatcher();

  export let language: 'en' | 'de' = 'en';
  // Falls bereits Scratchpads existieren, aber der Nutzer den Flow fortsetzen muss
  export let incomplete = false;
  // Wird wahr, solange das Profil-Scratchpad noch initialisiert wird
  export let profileInitializing = false;
  // Wird wahr, solange der POST-Aufruf für eine PublicID läuft
  export let publicIdentifierLoading = false;

  let step = 0; // 0 = Intro, 1 = DisplayName, 2 = ProfileImage, 3 = PublicIdentifier, 4 = Finish

  let displayName = '';
  let profileImage = '';
  let newPublicIdentifier = '';
  // Liste der bereits erfolgreich angelegten Public-Identifier kommt als Prop von außen
  export let publicIdentifiers: string[] = []; // Wird von App.svelte gereicht
  export let backendUrl: string;

  $: t = translations[language] as Record<string, string>;

  function start() {
    dispatch('start');
    step = 1;
  }

  function submitDisplayName() {
    if (!displayName.trim()) return;
    dispatch('setDisplayName', displayName.trim());
    step = 2;
  }

  function submitProfileImage() {
    dispatch('setProfileImage', profileImage.trim());
    step = 3;
  }

  function addPublicIdentifier() {
    const id = newPublicIdentifier.trim();
    if (!id) return;
    // Änderung wird erst nach erfolgreichem Backend-Aufruf in publicIdentifiers auftauchen
    dispatch('addPublicIdentifier', id);
    newPublicIdentifier = '';
  }

  function finish() {
    dispatch('finish');
  }
</script>

<style>
  .wizard-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
  }
  .wizard {
    background: var(--background-color, #222);
    padding: 2rem;
    border-radius: 12px;
    max-width: 550px;
    width: 90%;
    color: var(--text-color, #fff);
  }
  .wizard h2 {
    margin-top: 0;
  }
  .wizard img {
    max-width: 100%;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .input-group {
    margin: 1rem 0;
  }
  .input-group input {
    width: 100%;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--line-color,#555);
    background: var(--background-color,#222);
    color: inherit;
  }
  .button-row {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  button {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    background: var(--notification-color,#09f);
    color: #fff;
  }
  button[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .spinner {
    border: 3px solid #eee;
    border-top-color: var(--notification-color,#09f);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }
  @keyframes spin { to { transform: rotate(360deg)} }

  /* Stil für Komponenten */
  .wallet-wrapper {
    display: flex;
    justify-content: flex-start; /* Ausrichtung links */
  }
</style>

<div class="wizard-overlay">
  <div class="wizard">
    {#if step === 0}
      <img src={AccountImageSrc} alt="Account creation" />
      <p>{t.noAccountPackageFoundQuestion}</p>

      <!-- Integrierte Wallet-Komponente -->
      <div class="wallet-wrapper">
        <WalletInfo {backendUrl} language={language} />
      </div>

      <div class="button-row">
        <button on:click={start}>{incomplete ? t.finishAccountCreation : t.createFriendsAccount}</button>
      </div>
    {:else if step === 1}
      <h2>{t.chooseDisplayName}</h2>
      <div class="input-group">
        <input type="text" bind:value={displayName} placeholder={t.displayName} on:keydown={(e)=> e.key==='Enter' && submitDisplayName()} />
      </div>
      <div class="button-row">
        <button on:click={submitDisplayName} disabled={!displayName.trim()}>Next</button>
      </div>
    {:else if step === 2}
      <h2>{t.setProfileImageOptional}</h2>
      <div class="input-group">
        <input type="text" bind:value={profileImage} placeholder={t.enterDatamapAddress ?? 'Datamap address'} on:keydown={(e)=> e.key==='Enter' && submitProfileImage()} />
      </div>
      <div class="button-row">
        <button on:click={submitProfileImage}>Next</button>
      </div>
    {:else if step === 3}
      <h2>{t.choosePublicIdentifierOptional}</h2>
      {#if profileInitializing}
        <div class="spinner" title={t.waitingProfileInitialization}></div>
        <p style="text-align:center">{t.waitingProfileInitialization}</p>
      {:else}
        {#if publicIdentifiers.length > 0}
          <ul style="margin:0 0 1rem 0; padding-left:1rem; max-height:120px; overflow:auto">
            {#each publicIdentifiers as id}
              <li>{id}</li>
            {/each}
          </ul>
        {/if}
        <div class="input-group">
          <input type="text" bind:value={newPublicIdentifier} placeholder={t.enterPublicIdentifier} on:keydown={(e)=> e.key==='Enter' && addPublicIdentifier()} />
        </div>
        <div class="button-row">
          <button on:click={addPublicIdentifier} disabled={publicIdentifierLoading || !newPublicIdentifier.trim()}>{publicIdentifierLoading ? t.creatingPublicIdentifier : '+'}</button>
          <button on:click={() => step = 4}>Next</button>
        </div>
      {/if}
    {:else if step === 4}
      <h2>{t.finishAccountCreation}</h2>
      <p>{t.settingsUpdated}</p>
      <div class="button-row">
        <button on:click={finish}>{t.finishAccountCreation}</button>
      </div>
    {/if}
  </div>
</div>