<script lang="ts">
  import CSPReportsTable from './lib/CSPReportsTable.svelte';
  import Statistics from './lib/Statistics.svelte';
  import ThemeSwitcher from './lib/ThemeSwitcher.svelte';

  let currentPage: 'reports' | 'statistics' = 'reports';
</script>

<div class="min-h-screen bg-base-100">
  <!-- Navigation -->
  <nav class="navbar bg-base-200">
    <div class="flex-1">
      <div class="tabs tabs-boxed bg-base-300">
        <button 
          class="tab {currentPage === 'reports' ? 'tab-active' : ''}" 
          on:click={() => currentPage = 'reports'}
        >
          Reports
        </button>
        <button 
          class="tab {currentPage === 'statistics' ? 'tab-active' : ''}" 
          on:click={() => currentPage = 'statistics'}
        >
          Statistics
        </button>
      </div>
    </div>
    <div class="flex-none">
      <ThemeSwitcher />
    </div>
  </nav>

  <!-- Main Content -->
  <main class="container mx-auto">
    {#if currentPage === 'reports'}
      <CSPReportsTable />
    {:else if currentPage === 'statistics'}
      <Statistics />
    {/if}
  </main>
</div>
