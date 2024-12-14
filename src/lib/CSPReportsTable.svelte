<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { API_CONFIG } from '../config';

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

  // Fetch reports on component mount
  onMount(async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REPORTS}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      
      reports = await response.json();
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

  // Truncate long strings
  function truncate(str: string, maxLength: number = 50): string {
    return str.length > maxLength 
      ? str.substring(0, maxLength) + '...' 
      : str;
  }

  // Fetch and show report details
  async function showReportDetails(id: string) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REPORTS}/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch report ${id}`);
      }
      
      selectedReport = await response.json();
      modalOpen = true;
    } catch (err) {
      console.error(err);
    }
  }

  // Filter function
  $: filteredReports = reports.filter(report => {
    const searchLower = searchQuery.toLowerCase();
    return (
      report.report.violateddirective.toLowerCase().includes(searchLower) ||
      report.report.blockeduri.toLowerCase().includes(searchLower) ||
      report.report.clientip.toLowerCase().includes(searchLower) ||
      report.report.useragent.toLowerCase().includes(searchLower)
    );
  });

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

<div class="min-h-screen bg-base-100">
  <div class="container mx-auto px-4 py-8">
    <div class="card bg-base-200 shadow-xl p-6">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search reports..."
        class="input input-bordered w-full mb-4 text-sm"
      />

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
                <td>{report.report.violateddirective}</td>
                <td>{truncate(report.report.blockeduri)}</td>
                <td>{report.report.clientip}</td>
                <td>{truncate(report.report.useragent)}</td>
                <td>{formatDate(report.report.reporttime)}</td>
                <td>
                  <button 
                    on:click={() => showReportDetails(report._id)}
                    class="btn btn-primary btn-xs h-6 min-h-0 text-xs px-2"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Modal -->
{#if modalOpen && selectedReport}
  <div class="modal modal-open" role="dialog" aria-modal="true">
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg mb-4">Report Details</h3>
      <div class="overflow-x-auto">
        <table class="table table-sm w-full">
          <tbody>
            <tr>
              <td class="font-semibold w-1/4">ID</td>
              <td>{selectedReport._id}</td>
            </tr>
            <tr>
              <td class="font-semibold">Document URI</td>
              <td class="break-all">{selectedReport.report.documenturi}</td>
            </tr>
            <tr>
              <td class="font-semibold">Referrer</td>
              <td class="break-all">{selectedReport.report.referrer || '-'}</td>
            </tr>
            <tr>
              <td class="font-semibold">Violated Directive</td>
              <td>{selectedReport.report.violateddirective}</td>
            </tr>
            <tr>
              <td class="font-semibold">Effective Directive</td>
              <td>{selectedReport.report.effectivedirective}</td>
            </tr>
            <tr>
              <td class="font-semibold">Original Policy</td>
              <td class="break-all">{selectedReport.report.originalpolicy}</td>
            </tr>
            <tr>
              <td class="font-semibold">Disposition</td>
              <td>{selectedReport.report.disposition}</td>
            </tr>
            <tr>
              <td class="font-semibold">Blocked URI</td>
              <td class="break-all">{selectedReport.report.blockeduri}</td>
            </tr>
            <tr>
              <td class="font-semibold">Line Number</td>
              <td>{selectedReport.report.linenumber}</td>
            </tr>
            <tr>
              <td class="font-semibold">Source File</td>
              <td class="break-all">{selectedReport.report.sourcefile}</td>
            </tr>
            <tr>
              <td class="font-semibold">Status Code</td>
              <td>{selectedReport.report.statuscode}</td>
            </tr>
            <tr>
              <td class="font-semibold">Script Sample</td>
              <td>{selectedReport.report.scriptsample || '-'}</td>
            </tr>
            <tr>
              <td class="font-semibold">Client IP</td>
              <td>{selectedReport.report.clientip}</td>
            </tr>
            <tr>
              <td class="font-semibold">User Agent</td>
              <td class="break-all">{selectedReport.report.useragent}</td>
            </tr>
            <tr>
              <td class="font-semibold">Report Time</td>
              <td>{formatDate(selectedReport.report.reporttime)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-action">
        <button class="btn btn-sm" on:click={closeModal}>Close</button>
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
