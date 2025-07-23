<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translations } from '../../i18n/translations';
  import type { ProfileData } from '../webrtc/FriendRequestManager';
  
  export let language: 'en' | 'de' | 'fr' | 'es' | 'bg' | 'ja' | 'ko' | 'zh' = 'en';
  export let friendRequestManager: any;
  
  const dispatch = createEventDispatcher();
  const t = translations[language];
  
  let profileId = '';
  // Stores resolved profile ID (96-char address) after lookup; may differ from user input
  let resolvedProfileId = '';
  let displayName = '';
  let profileData: ProfileData | null = null;
  let loading = false;
  let error = '';

  // Constant for pointer requests – same as used elsewhere
  const ANT_OWNER_SECRET = '6e273a3c19d3e908e905dc6537b7cfb9010ca7650a605886029850cef60cd440';

  // Helper to build pointer URL
  function buildPointerUrl(objectName: string): string {
    const base = friendRequestManager?.backendUrl ? `${friendRequestManager.backendUrl}/dweb-0/pointer` : '/dweb-0/pointer';
    return `${base}?object_name=${encodeURIComponent(objectName)}`;
  }

  async function resolvePublicIdentifier(identifier: string): Promise<string | null> {
    try {
      const url = buildPointerUrl(identifier);
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          'Ant-App-ID': 'friends',
          'Ant-Owner-Secret': ANT_OWNER_SECRET
        }
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      // If server wraps in array, unwrap
      const obj = Array.isArray(data) && data.length > 0 ? data[0] : data;
      const pid = obj?.chunk_target_address || obj?.pointer_target_address || obj?.scratchpad_target_address || '';
      if (pid.length === 96) {
        return pid;
      }
      return null;
    } catch (e) {
      console.error('Error resolving public identifier', e);
      return null;
    }
  }
  
  // Derive backendUrl from manager if available
  $: backendUrl = friendRequestManager?.backendUrl || '';
  
  // Compute full profile image URL
  $: profileImageUrl = profileData && profileData.profileImage
    ? (profileData.profileImage.startsWith('http')
        ? profileData.profileImage
        : backendUrl
          ? `${backendUrl}/dweb-0/data/${profileData.profileImage}`
          : `/dweb-0/data/${profileData.profileImage}`)
    : '';
  
  async function loadProfile() {
    if (!profileId.trim()) {
      error = t.enterProfileId;
      return;
    }
    
    // Determine whether input is profileId or public identifier
    const inputVal = profileId.trim();
    if (inputVal.length !== 96) {
      loading = true;
      error = '';
      profileData = null;
      const resolved = await resolvePublicIdentifier(inputVal);
      if (!resolved) {
        error = t.profileNotFound;
        loading = false;
        return;
      }
      resolvedProfileId = resolved;
    } else {
      resolvedProfileId = inputVal;
    }

    loading = true;
    error = '';
    profileData = null;
    
    try {
      const data = await friendRequestManager.readProfile(resolvedProfileId);
      if (data) {
        profileData = data;
        displayName = data.accountname;
      } else {
        error = t.profileNotFound;
      }
    } catch (err) {
      error = t.errorLoadingProfile;
      console.error('Error loading profile:', err);
    } finally {
      loading = false;
    }
  }
  
  async function sendFriendRequest() {
    if (!profileData || !displayName.trim()) {
      error = t.enterDisplayName;
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      // Handshake-Adresse wird in App.svelte erstellt, hier nur Event auslösen
      dispatch('friendRequestSent', { 
        profileId: resolvedProfileId, 
        displayName,
        profileData 
      });
      close();
    } catch (err) {
      error = t.errorSendingRequest;
      console.error('Error sending friend request:', err);
    } finally {
      loading = false;
    }
  }
  
  function close() {
    dispatch('close');
    // Reset form
    profileId = '';
    resolvedProfileId = '';
    displayName = '';
    profileData = null;
    error = '';
  }
</script>

<div class="modal-overlay" on:click|self={close}>
  <div class="modal-content">
    <h2>{t.addNewFriend}</h2>
    <button class="close-button" on:click={close}>×</button>
    
    <div class="form-group">
      <label for="profile-id">{t.profileIdOrPublicIdentifier || t.profileId}</label>
      <div class="input-with-button">
        <input
          id="profile-id"
          type="text"
          bind:value={profileId}
          placeholder={t.enterIdOrIdentifier || t.enterProfileId}
          disabled={loading}
          on:keydown={(e) => e.key === 'Enter' && loadProfile()}
        />
        <button 
          on:click={loadProfile} 
          disabled={loading || !profileId.trim()}
          class="load-button"
        >
          {loading ? t.loading : t.loadProfile}
        </button>
      </div>
    </div>
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    {#if profileData}
      <div class="profile-preview">
        <h3>{t.profilePreview}</h3>
        <div class="profile-info">
          {#if profileData.profileImage}
            <img 
              src={profileImageUrl} 
              alt={profileData.accountname || ''}
              class="profile-image"
            />
          {:else}
            <div class="profile-image-placeholder">
              {(profileData.accountname || '?').charAt(0).toUpperCase()}
            </div>
          {/if}
          <div class="profile-details">
            <p class="account-name">{profileData.accountname}</p>
            {#if resolvedProfileId}
              <p class="profile-id-display">{resolvedProfileId}</p>
            {/if}
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
        
        <div class="modal-buttons">
          <button on:click={close} class="secondary-button">
            {t.cancel}
          </button>
          <button 
            on:click={sendFriendRequest} 
            disabled={loading || !displayName.trim()}
            class="primary-button"
          >
            {loading ? t.sending : t.sendFriendRequest}
          </button>
        </div>
      </div>
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
  
  h3 {
    margin: 1rem 0;
    color: var(--text-color);
    font-size: 1.1rem;
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
  
  .input-with-button {
    display: flex;
    gap: 0.5rem;
  }
  
  .input-with-button input {
    flex: 1;
  }
  
  .load-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    background: var(--notification-color);
    color: white;
    cursor: pointer;
    font-size: 0.9rem;
    transition: opacity 0.2s;
  }
  
  .load-button:hover:not(:disabled) {
    opacity: 0.8;
  }
  
  .load-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .error-message {
    color: var(--notification-color);
    margin: 1rem 0;
    padding: 0.5rem;
    background: rgba(255, 0, 0, 0.1);
    border-radius: 4px;
  }
  
  .profile-preview {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--line-color);
  }
  
  .profile-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .profile-image,
  .profile-image-placeholder {
    width: 60px;
    height: 60px;
    border-radius: 12px;
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
    border-radius: 12px;
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
    margin: 0;
    word-break: break-all;
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
</style> 