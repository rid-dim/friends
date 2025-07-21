<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translations } from '../i18n/translations';
  
  export let profileImage: string = '';
  export let themeUrl: string = '';
  export let language: string = 'en';
  export let backendUrl: string = '';
  
  const dispatch = createEventDispatcher();
  
  $: t = translations[language as keyof typeof translations] || translations.en;
  
  // Build full URL for profile image
  $: profileImageUrl = profileImage ? 
    (profileImage.startsWith('http') ? profileImage : 
     backendUrl ? `${backendUrl}/dweb-0/data/${profileImage}` : `/dweb-0/data/${profileImage}`) : 
    '';
  
  function handleProfileImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    dispatch('update', { 
      field: 'profileImage', 
      value: input.value 
    });
  }
  
  function handleThemeUrlChange(event: Event) {
    const input = event.target as HTMLInputElement;
    dispatch('update', { 
      field: 'themeUrl', 
      value: input.value 
    });
  }
  
  function handleLanguageChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    dispatch('update', { 
      field: 'language', 
      value: select.value 
    });
  }
</script>

<div class="account-settings">
  <h3>{t.accountSettings}</h3>
  
  <div class="setting-group">
    <label for="profile-image">{t.profileImage}</label>
    <input
      id="profile-image"
      type="text"
      placeholder={t.enterDatamapAddress}
      value={profileImage}
      on:input={handleProfileImageChange}
    />
    {#if profileImageUrl}
      <div class="preview">
        <img src={profileImageUrl} alt="Profile" />
      </div>
    {/if}
  </div>
  
  <div class="setting-group">
    <label for="theme-url">{t.themeUrl}</label>
    <input
      id="theme-url"
      type="text"
      placeholder={t.enterThemeUrl}
      value={themeUrl}
      on:input={handleThemeUrlChange}
    />
  </div>
  
  <div class="setting-group">
    <label for="language">{t.language}</label>
    <select
      id="language"
      value={language}
      on:change={handleLanguageChange}
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
</div>

<style>
  .account-settings {
    padding: 1rem;
    background: var(--background-color);
    border-radius: 8px;
    border: 1px solid var(--line-color);
  }
  
  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
  }
  
  .setting-group {
    margin-bottom: 1rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
  }
  
  input, select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--line-color);
    border-radius: 4px;
    background: var(--background-color);
    color: inherit;
    font-size: 0.9rem;
  }
  
  .preview {
    margin-top: 0.5rem;
    max-width: 100px;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .preview img {
    width: 100%;
    height: auto;
    display: block;
  }
</style> 