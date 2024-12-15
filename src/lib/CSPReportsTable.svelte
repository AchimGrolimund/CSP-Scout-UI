<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { API_CONFIG, sanitizeInput, sanitizeHtml, checkRateLimit } from '../config';

  // Define interface matching the Go struct
  interface ReportData {
    documenturi: string;
    referrer: string;
    violateddirective: string;
    effectivedirective: string;
    originalpolicy: string;
    disposition: string;
    blockeduri: string;
    linenumber: number;
    sourcefile: string;
    statuscode: number;
    scriptsample: string;
    clientip: string;
    useragent: string;
    reporttime: number;
  }

  interface Report {
    _id: string;
    report: ReportData;
  }

  // State variables
  let reports: Report[] = [];
  let loading = true;
  let error: string | null = null;
  let searchQuery = "";
  let filteredReports: Report[] = [];
  let sortField: keyof ReportData = 'reporttime';
  let sortDirection: 'asc' | 'desc' = 'desc';
  let selectedReport: Report | null = null;
  let modalOpen = false;
  let rateLimitExceeded = false;

  // Generate a client ID for rate limiting (in a real app, use a more robust method)
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && modalOpen) {
      closeModal();
    }
  }

  $: if (modalOpen) {
    window.addEventListener('keydown', handleKeydown);
  } else {
    window.removeEventListener('keydown', handleKeydown);
  }

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  // Cache implementation
  const cache = new Map<string, { data: any; timestamp: number }>();

  async function fetchWithRetry(url: string, retryCount = 0): Promise<Response> {
    // Check rate limit before making request
    if (!checkRateLimit(clientId)) {
      rateLimitExceeded = true;
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

      // Add security headers
      const headers = new Headers({
        'Origin': window.location.origin,
      });

      const response = await fetch(url, { 
        signal: controller.signal,
        headers,
        credentials: 'include' // Required for CORS with credentials
      });
      
      clearTimeout(timeoutId);

      // Validate response headers
      const contentType = response.headers.get('Content-Type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid response content type');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (err) {
      if (retryCount < API_CONFIG.RETRY_CONFIG.MAX_RETRIES) {
        await new Promise(resolve => 
          setTimeout(resolve, API_CONFIG.RETRY_CONFIG.RETRY_DELAY_MS)
        );
        return fetchWithRetry(url, retryCount + 1);
      }
      throw err;
    }
  }

  async function fetchWithCache<T>(url: string): Promise<T> {
    if (API_CONFIG.CACHE_CONFIG.ENABLED) {
      const cached = cache.get(url);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < API_CONFIG.CACHE_CONFIG.DURATION_MS) {
        return cached.data as T;
      }
    }

    const response = await fetchWithRetry(url);
    const data = await response.json();

    if (API_CONFIG.CACHE_CONFIG.ENABLED) {
      cache.set(url, {
        data,
        timestamp: Date.now()
      });
    }

    return data as T;
  }

  // Fetch reports on component mount
  onMount(async () => {
    try {
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REPORTS}`;
      reports = await fetchWithCache<Report[]>(url);
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An unknown error occurred';
      loading = false;
    }
  });

  // Convert timestamp to readable date
  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
  }

  // Truncate and sanitize long strings
  function truncate(str: string, maxLength: number = 50): string {
    const sanitized = sanitizeHtml(str);
    return sanitized.length > maxLength 
      ? sanitized.substring(0, maxLength) + '...' 
      : sanitized;
  }

  // Fetch and show report details
  async function showReportDetails(id: string) {
    try {
      // Sanitize the ID before using it in the URL
      const sanitizedId = sanitizeInput(id);
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REPORTS}/${sanitizedId}`;
      selectedReport = await fetchWithCache<Report>(url);
      modalOpen = true;
    } catch (err) {
      console.error(err);
      error = err instanceof Error ? err.message : 'Failed to fetch report details';
    }
  }

  // Filter function with sanitized input
  $: {
    const sanitizedQuery = sanitizeInput(searchQuery.toLowerCase());
    filteredReports = reports.filter(report => {
      return (
        report.report.violateddirective.toLowerCase().includes(sanitizedQuery) ||
        report.report.blockeduri.toLowerCase().includes(sanitizedQuery) ||
        report.report.clientip.toLowerCase().includes(sanitizedQuery) ||
        report.report.useragent.toLowerCase().includes(sanitizedQuery)
      );
    });
  }

  function sortReports(field: keyof ReportData) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }

    filteredReports = filteredReports.sort((a, b) => {
      const aValue = a.report[field];
      const bValue = b.report[field];
      return sortDirection === 'asc' 
        ? aValue > bValue ? 1 : -1
        : aValue < bValue ? 1 : -1;
    });
  }

  function closeModal() {
    modalOpen = false;
    selectedReport = null;
  }
</script>

<svelte:head>
  <!-- Implement CSP headers -->
  {#each Object.entries(API_CONFIG.SECURITY.CSP.directives) as [directive, sources]}
    <meta 
      http-equiv="content-security-policy" 
      content="{directive} {sources.join(' ')}"
    >
  {/each}
</svelte:head>

<div class="min-h-screen bg-base-100">
  <div class="container mx-auto px-4 py-8">
    <div class="card bg-base-200 shadow-xl p-6">
      {#if rateLimitExceeded}
        <div class="alert alert-warning mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Rate limit exceeded. Please try again later.</span>
        </div>
      {/if}

      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search reports..."
        class="input input-bordered w-full mb-4 text-sm"
        maxlength="100"
        aria-label="Search reports"
      />

      {#if loading}
        <div class="flex justify-center items-center p-8">
          <div class="loading loading-spinner loading-lg"></div>
        </div>
      {:else if error}
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{sanitizeHtml(error)}</span>
          <button 
            class="btn btn-sm" 
            on:click={() => window.location.reload()}
            aria-label="Retry loading reports"
          >
            Retry
          </button>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table table-zebra text-sm">
            <thead>
              <tr class="border-b border-base-300">
                <th class="cursor-pointer" on:click={() => sortReports('violateddirective')}>
                  Violated Directive {sortField === 'violateddirective' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th class="cursor-pointer" on:click={() => sortReports('blockeduri')}>
                  Blocked URI {sortField === 'blockeduri' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th class="cursor-pointer" on:click={() => sortReports('clientip')}>Client IP</th>
                <th class="cursor-pointer" on:click={() => sortReports('useragent')}>User Agent</th>
                <th class="cursor-pointer" on:click={() => sortReports('reporttime')}>Report Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredReports as report (report._id)}
                <tr class="hover border-b border-base-300">
                  <td>{sanitizeHtml(report.report.violateddirective)}</td>
                  <td>{truncate(report.report.blockeduri)}</td>
                  <td>{sanitizeHtml(report.report.clientip)}</td>
                  <td>{truncate(report.report.useragent)}</td>
                  <td>{formatDate(report.report.reporttime)}</td>
                  <td>
                    <button 
                      on:click={() => showReportDetails(report._id)}
                      class="btn btn-primary btn-xs h-6 min-h-0 text-xs px-2"
                      aria-label={`View details for report ${report._id}`}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Modal -->
{#if modalOpen && selectedReport}
  <div 
    class="modal modal-open" 
    role="dialog" 
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div class="modal-box max-w-3xl">
      <h3 id="modal-title" class="font-bold text-lg mb-4">Report Details</h3>
      <div class="overflow-x-auto">
        <table class="table table-sm w-full">
          <tbody>
            <tr>
              <td class="font-semibold w-1/4">ID</td>
              <td>{sanitizeHtml(selectedReport._id)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Document URI</td>
              <td class="break-all">{sanitizeHtml(selectedReport.report.documenturi)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Referrer</td>
              <td class="break-all">{sanitizeHtml(selectedReport.report.referrer || '-')}</td>
            </tr>
            <tr>
              <td class="font-semibold">Violated Directive</td>
              <td>{sanitizeHtml(selectedReport.report.violateddirective)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Effective Directive</td>
              <td>{sanitizeHtml(selectedReport.report.effectivedirective)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Original Policy</td>
              <td class="break-all">{sanitizeHtml(selectedReport.report.originalpolicy)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Disposition</td>
              <td>{sanitizeHtml(selectedReport.report.disposition)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Blocked URI</td>
              <td class="break-all">{sanitizeHtml(selectedReport.report.blockeduri)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Line Number</td>
              <td>{selectedReport.report.linenumber}</td>
            </tr>
            <tr>
              <td class="font-semibold">Source File</td>
              <td class="break-all">{sanitizeHtml(selectedReport.report.sourcefile)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Status Code</td>
              <td>{selectedReport.report.statuscode}</td>
            </tr>
            <tr>
              <td class="font-semibold">Script Sample</td>
              <td>{sanitizeHtml(selectedReport.report.scriptsample || '-')}</td>
            </tr>
            <tr>
              <td class="font-semibold">Client IP</td>
              <td>{sanitizeHtml(selectedReport.report.clientip)}</td>
            </tr>
            <tr>
              <td class="font-semibold">User Agent</td>
              <td class="break-all">{sanitizeHtml(selectedReport.report.useragent)}</td>
            </tr>
            <tr>
              <td class="font-semibold">Report Time</td>
              <td>{formatDate(selectedReport.report.reporttime)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-action">
        <button 
          class="btn btn-sm" 
          on:click={closeModal}
          aria-label="Close modal"
        >
          Close
        </button>
      </div>
    </div>
    <button 
      class="modal-backdrop" 
      on:click={closeModal}
      aria-label="Close modal"
      tabindex="0"
    ></button>
  </div>
{/if}
