<script lang="ts">
  import { language, getAvailableLanguages, languageNames } from './i18n';
  
  // Verfügbare Sprachen für die Auswahl
  const languages = getAvailableLanguages();
  
  // Lokale Kopie der aktuellen Sprache
  let selectedLanguage: string;
  
  // Aktualisiere die lokale Kopie, wenn sich der Store ändert
  language.subscribe(value => {
    selectedLanguage = value;
  });
  
  // Handler für die Sprachänderung
  function handleLanguageChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    language.set(select.value as any);
  }
</script>

<div class="language-selector">
  <select bind:value={selectedLanguage} on:change={handleLanguageChange}>
    {#each languages as lang}
      <option value={lang.code}>{lang.name}</option>
    {/each}
  </select>
</div>

<style>
  .language-selector {
    margin-bottom: 0.5rem;
  }
  
  select {
    padding: 0.3rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.85rem;
    background-color: #fff;
    width: 100%;
  }
</style> 