<script lang="ts">
  import { onMount } from 'svelte';
  import { translations } from '../../i18n/translations';
  import type { Language } from '../../i18n/translations';

  export let backendUrl: string;
  export let language: Language;
  export let gray: boolean = true; // Option, ob mit grauem Hintergrund oder nicht

  let walletInfo: { wallet_address: string; ant_balance: string; eth_balance: string } | null = null;
  let loading = true;
  let error: string | null = null;

  // Reaktive Übersetzungen
  $: t = translations[language] || ({} as any);

  async function fetchWalletInfo() {
    if (!backendUrl) {
      error = "No backend URL provided";
      loading = false;
      return;
    }

    try {
      loading = true;
      const response = await fetch(`${backendUrl}/dweb-0/wallet-balance`);
      if (response.ok) {
        walletInfo = await response.json();
      } else {
        error = `Failed to fetch wallet balance: ${response.status} ${response.statusText}`;
        console.error(error);
      }
    } catch (err) {
      error = `Error fetching wallet balance: ${err}`;
      console.error(error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchWalletInfo();
  });
</script>

{#if loading}
  <div class="wallet-loading">
    <div class="spinner"></div>
  </div>
{:else if error}
  <div class="wallet-error">
    {error}
  </div>
{:else if walletInfo}
  <div class="wallet-info" class:gray>
    <div>
      <span><strong>{walletInfo.wallet_address}</strong></span>
    </div>
    <div>
      <strong>{t.antBalance || 'ANT'}:</strong>
      <span>{walletInfo.ant_balance}</span>
    </div>
    <div>
      <strong>{t.ethBalance || 'ETH'}:</strong>
      <span>{walletInfo.eth_balance}</span>
    </div>
  </div>
{:else}
  <div class="wallet-not-found">
    {t.walletNotFound || 'Wallet information not available'}
  </div>
{/if}

<style>
  .wallet-info {
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    display: inline-block; /* Macht die Box nur so breit wie ihr Inhalt */
  }
  
  .gray {
    background-color: var(--foreground-color2);
  }
  
  .wallet-info div {
    margin-bottom: 0.5rem;
  }
  
  .wallet-info span {
    word-break: break-all;
    margin-left: 0.5rem;
  }
  
  .spinner {
    border: 3px solid #eee;
    border-top-color: var(--notification-color, #09f);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }
  
  @keyframes spin { to { transform: rotate(360deg)} }
  
  .wallet-loading, .wallet-error, .wallet-not-found {
    padding: 1rem;
    text-align: center;
    margin: 1rem 0;
    border-radius: 8px;
    display: inline-block; /* Macht die Box nur so breit wie ihr Inhalt */
  }
  
  .wallet-error {
    background-color: rgba(255, 0, 0, 0.1);
    color: #f66;
  }
</style>
