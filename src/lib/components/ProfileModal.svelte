<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translations } from '../../i18n/translations';
  import type { FriendRequest, ProfileData } from '../webrtc/FriendRequestManager';
  
  export let language: 'en' | 'de' | 'fr' | 'es' | 'bg' | 'ja' | 'ko' | 'zh' = 'en';
  export let friendRequest: FriendRequest;
  export let profileData: ProfileData | null;
  export let friendRequestManager: any;
  
  const dispatch = createEventDispatcher();
  const t = translations[language];
  
  let displayName = profileData?.accountname || '';

  // Prefill displayName whenever profileData changes (only if empty)
  $: if (profileData && !displayName) {
    displayName = profileData.accountname;
  }
  let loading = false;
  let error = '';
  let declineLoading = false;

  function declineRequest() {
    declineLoading = true;
    dispatch('decline');
    declineLoading = false;
    close();
  }
  
  async function acceptRequest() {
    if (!displayName.trim()) {
      error = t.enterDisplayName;
      return;
    }
    
    loading = true;
    error = '';
    // Simply dispatch accept event to parent; parent handles friendRequestManager logic
    dispatch('accept', {
      displayName: displayName.trim()
    });
    loading = false;
    close();
  }
  
  function close() {
    dispatch('close');
  }

  $: declineLabel = language === 'de' ? 'Ablehnen' : 'Decline';
</script>

<div class="modal-overlay" on:click|self={close}>
  <div class="modal-content">
    <h2>{t.newFriendRequests}</h2>
    <button class="close-button" on:click={close}>×</button>
    
    {#if profileData}
      <div class="profile-info">
        {#if profileData.profileImage}
          <img 
            src={profileData.profileImage} 
            alt={profileData.accountname}
            class="profile-image"
          />
        {:else}
          <div class="profile-image-placeholder">
            {profileData.accountname.charAt(0).toUpperCase()}
          </div>
        {/if}
        <div class="profile-details">
          <p class="account-name">{profileData.accountname}</p>
          <p class="profile-id-display">{friendRequest.profileId}</p>
          <p class="request-time">
            {new Date(friendRequest.time).toLocaleString(language)}
          </p>
        </div>
      </div>
      
      <div class="form-group">
        <label for="display-name">{t.displayName}</label>
        <input
          id="display-name"
          type="text"
          bind:value={displayName}
          placeholder={t.enterDisplayName}
          disabled={loading}
        />
      </div>
      
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <div class="modal-buttons">
        <button on:click={close} class="secondary-button">
          {t.cancel}
        </button>
        <button on:click={declineRequest} class="danger-button">
          {declineLoading ? t.loading : declineLabel}
        </button>
        <button 
          on:click={acceptRequest} 
          disabled={loading || !displayName.trim()}
          class="primary-button"
        >
          {loading ? t.sending : t.acceptFriendRequest}
        </button>
      </div>
    {:else}
      <p>{t.loading}</p>
    {/if}
  </div>
</div>

<style>
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
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  h2 {
    margin: 0 0 1.5rem 0;
    color: var(--text-color);
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
    color: var(--text-color);
  }
  
  .close-button:hover {
    opacity: 1;
  }
  
  .profile-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--foreground-color1);
    border-radius: 8px;
  }
  
  .profile-image,
  .profile-image-placeholder {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .profile-image-placeholder {
    background: var(--foreground-color2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--text-color);
  }
  
  .profile-details {
    flex: 1;
  }
  
  .account-name {
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--text-color);
  }
  
  .profile-id-display {
    font-size: 0.85rem;
    opacity: 0.7;
    margin: 0 0 0.25rem 0;
    word-break: break-all;
  }
  
  .request-time {
    font-size: 0.8rem;
    opacity: 0.6;
    margin: 0;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-color);
  }
  
  input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--line-color);
    border-radius: 6px;
    background: var(--foreground-color1);
    color: var(--text-color);
    font-size: 0.9rem;
  }
  
  .error-message {
    color: var(--notification-color);
    margin: 1rem 0;
    padding: 0.5rem;
    background: rgba(255, 0, 0, 0.1);
    border-radius: 4px;
  }
  
  .modal-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }
  
  .primary-button,
  .secondary-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .primary-button {
    background: var(--notification-color);
    color: white;
  }
  
  .secondary-button {
    background: var(--foreground-color2);
    color: var(--text-color);
  }
  
  .primary-button:hover:not(:disabled),
  .secondary-button:hover {
    opacity: 0.8;
  }
  
  .primary-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .danger-button {
    background: var(--notification-color);
    color: white;
  }
</style> 