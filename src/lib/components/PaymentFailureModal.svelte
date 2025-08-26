<script lang="ts">
  import { translations } from '../../i18n/translations';

  export let language: 'en' | 'de' | 'fr' | 'es' | 'bg' | 'ja' | 'ko' | 'zh' = 'en';
  export let visible: boolean = false;
  export let onClose: () => void = () => {};

  const t = translations[language] as Record<string, string>;

  function close() {
    onClose?.();
  }
</script>

{#if visible}
<div class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal-content">
    <h2>{t.paymentFailureTitle}</h2>
    <div class="message">
      {t.paymentFailureMessage}
    </div>
    <div class="modal-buttons">
      <button class="primary-button" on:click={close}>{t.ok || 'OK'}</button>
    </div>
  </div>
</div>
{/if}

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
    z-index: 3000;
  }

  .modal-content {
    background: var(--background-color);
    padding: 2rem;
    border-radius: 12px;
    max-width: 560px;
    width: 92%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  h2 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
  }

  .message {
    color: var(--text-color);
    line-height: 1.5;
    margin-bottom: 1.25rem;
    white-space: pre-wrap;
  }

  .modal-buttons {
    display: flex;
    justify-content: flex-end;
  }

  .primary-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    background: var(--notification-color);
    color: white;
    cursor: pointer;
  }
</style>


