<script lang="ts">
  import { onMount } from 'svelte';
  import { API_CONFIG, sanitizeInput, sanitizeHtml, checkRateLimit } from '../config';
  import * as UAParser from 'ua-parser-js';

  interface Report {
    _id: string;
    report: {
      useragent: string;
      clientip: string;
      violateddirective: string;
      referrer: string;
      blockeduri: string;
    };
  }

  // State variables
  let reports: Report[] = [];
  let loading = true;
  let error: string | null = null;
  let rateLimitExceeded = false;

  // Statistics data
  let topUserAgents: { useragent: string; count: number }[] = [];
  let topIPs: { ip: string; count: number }[] = [];
  let topViolatedDirectives: { directive: string; count: number }[] = [];
  let topReferrers: { referrer: string; count: number }[] = [];
  let topBlockedURIs: { uri: string; count: number }[] = [];
  let topOS: { os: string; count: number }[] = [];
  let topBrowsers: { browser: string; count: number }[] = [];

  // Generate a client ID for rate limiting (in a real app, use a more robust method)
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

  onMount(async () => {
    try {
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REPORTS}`;
      reports = await fetchWithCache<Report[]>(url);
      calculateStatistics();
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An unknown error occurred';
      loading = false;
    }
  });

  function calculateStatistics() {
    const parser = new UAParser.UAParser();
    const userAgentCounts = new Map<string, number>();
    const ipCounts = new Map<string, number>();
    const directiveCounts = new Map<string, number>();
    const referrerCounts = new Map<string, number>();
    const blockedURICounts = new Map<string, number>();
    const osCounts = new Map<string, number>();
    const browserCounts = new Map<string, number>();

    reports.forEach(report => {
      // Sanitize all inputs before processing
      const ua = sanitizeInput(report.report.useragent);
      const ip = sanitizeInput(report.report.clientip);
      const directive = sanitizeInput(report.report.violateddirective);
      const referrer = report.report.referrer ? sanitizeInput(report.report.referrer) : '';
      const uri = sanitizeInput(report.report.blockeduri);

      // Count user agents
      userAgentCounts.set(ua, (userAgentCounts.get(ua) || 0) + 1);

      // Count IPs
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);

      // Count violated directives
      directiveCounts.set(directive, (directiveCounts.get(directive) || 0) + 1);

      // Count referrers (skip empty ones)
      if (referrer) {
        referrerCounts.set(referrer, (referrerCounts.get(referrer) || 0) + 1);
      }

      // Count blocked URIs
      blockedURICounts.set(uri, (blockedURICounts.get(uri) || 0) + 1);

      // Parse user agent for OS and browser info
      parser.setUA(ua);
      const result = parser.getResult();
      
      // Count OS
      const os = sanitizeInput(`${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim());
      osCounts.set(os, (osCounts.get(os) || 0) + 1);

      // Count browsers
      const browser = sanitizeInput(`${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim());
      browserCounts.set(browser, (browserCounts.get(browser) || 0) + 1);
    });

    // Convert to arrays and sort
    topUserAgents = Array.from(userAgentCounts.entries())
      .map(([useragent, count]) => ({ useragent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    topIPs = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    topViolatedDirectives = Array.from(directiveCounts.entries())
      .map(([directive, count]) => ({ directive, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    topReferrers = Array.from(referrerCounts.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    topBlockedURIs = Array.from(blockedURICounts.entries())
      .map(([uri, count]) => ({ uri, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    topOS = Array.from(osCounts.entries())
      .map(([os, count]) => ({ os, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    topBrowsers = Array.from(browserCounts.entries())
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
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
  <div class="container mx-auto px-2 py-4">
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
          aria-label="Retry loading statistics"
        >
          Retry
        </button>
      </div>
    {:else if rateLimitExceeded}
      <div class="alert alert-warning mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Rate limit exceeded. Please try again later.</span>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <!-- Top Violated Directives -->
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body p-3">
            <h2 class="text-sm font-bold mb-2">Top Violated Directives</h2>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-xs w-full">
                <thead>
                  <tr>
                    <th>Directive</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {#each topViolatedDirectives as {directive, count}}
                    <tr class="hover">
                      <td>{sanitizeHtml(directive)}</td>
                      <td>{count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Top Referrers -->
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body p-3">
            <h2 class="text-sm font-bold mb-2">Top Referrers</h2>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-xs w-full">
                <thead>
                  <tr>
                    <th>Referrer</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {#each topReferrers as {referrer, count}}
                    <tr class="hover">
                      <td class="break-all">{sanitizeHtml(referrer || '-')}</td>
                      <td>{count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Top Blocked URIs -->
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body p-3">
            <h2 class="text-sm font-bold mb-2">Top Blocked URIs</h2>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-xs w-full">
                <thead>
                  <tr>
                    <th>URI</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {#each topBlockedURIs as {uri, count}}
                    <tr class="hover">
                      <td class="break-all">{sanitizeHtml(uri)}</td>
                      <td>{count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Top Operating Systems -->
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body p-3">
            <h2 class="text-sm font-bold mb-2">Top Operating Systems</h2>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-xs w-full">
                <thead>
                  <tr>
                    <th>OS</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {#each topOS as {os, count}}
                    <tr class="hover">
                      <td>{sanitizeHtml(os)}</td>
                      <td>{count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Top Browsers -->
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body p-3">
            <h2 class="text-sm font-bold mb-2">Top Browsers</h2>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-xs w-full">
                <thead>
                  <tr>
                    <th>Browser</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {#each topBrowsers as {browser, count}}
                    <tr class="hover">
                      <td>{sanitizeHtml(browser)}</td>
                      <td>{count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Top IPs -->
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body p-3">
            <h2 class="text-sm font-bold mb-2">Top IPs</h2>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-xs w-full">
                <thead>
                  <tr>
                    <th>IP Address</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {#each topIPs as {ip, count}}
                    <tr class="hover">
                      <td>{sanitizeHtml(ip)}</td>
                      <td>{count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
