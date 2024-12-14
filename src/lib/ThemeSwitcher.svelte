<script lang="ts">
  import { onMount } from 'svelte';

  const themes = ['light', 'dark', 'luxury'];
  let currentTheme: string;
  
  onMount(() => {
    // Get theme from localStorage or default to 'luxury'
    currentTheme = localStorage.getItem('theme') || 'luxury';
    setTheme(currentTheme);
  });
  
  function setTheme(theme: string) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
</script>

<div class="dropdown dropdown-end">
  <button class="btn btn-ghost m-1">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
    {currentTheme || 'Theme'}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>
  <ul class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52">
    {#each themes as theme}
      <li>
        <button 
          class="capitalize {theme === currentTheme ? 'active' : ''}" 
          on:click={() => setTheme(theme)}
        >
          {theme}
        </button>
      </li>
    {/each}
  </ul>
</div>
