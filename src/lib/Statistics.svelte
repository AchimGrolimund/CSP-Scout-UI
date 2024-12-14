<script lang="ts">
  import { onMount } from 'svelte';
  import { API_CONFIG } from '../config';
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

  let reports: Report[] = [];
  let loading = true;
  let error: string | null = null;

  // Statistics data
  let topUserAgents: { useragent: string; count: number }[] = [];
  let topIPs: { ip: string; count: number }[] = [];
  let topViolatedDirectives: { directive: string; count: number }[] = [];
  let topReferrers: { referrer: string; count: number }[] = [];
  let topBlockedURIs: { uri: string; count: number }[] = [];
  let topOS: { os: string; count: number }[] = [];
  let topBrowsers: { browser: string; count: number }[] = [];

  onMount(async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REPORTS}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      
      reports = await response.json();
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
      // Count user agents
      const ua = report.report.useragent;
      userAgentCounts.set(ua, (userAgentCounts.get(ua) || 0) + 1);

      // Count IPs
      const ip = report.report.clientip;
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);

      // Count violated directives
      const directive = report.report.violateddirective;
      directiveCounts.set(directive, (directiveCounts.get(directive) || 0) + 1);

      // Count referrers (skip empty ones)
      const referrer = report.report.referrer;
      if (referrer) {
        referrerCounts.set(referrer, (referrerCounts.get(referrer) || 0) + 1);
      }

      // Count blocked URIs
      const uri = report.report.blockeduri;
      blockedURICounts.set(uri, (blockedURICounts.get(uri) || 0) + 1);

      // Parse user agent for OS and browser info
      parser.setUA(ua);
      const result = parser.getResult();
      
      // Count OS
      const os = `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim();
      osCounts.set(os, (osCounts.get(os) || 0) + 1);

      // Count browsers
      const browser = `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim();
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

<div class="min-h-screen bg-base-100">
  <div class="container mx-auto px-2 py-4">
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
                    <td>{directive}</td>
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
                    <td class="break-all">{referrer || '-'}</td>
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
                    <td class="break-all">{uri}</td>
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
                    <td>{os}</td>
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
                    <td>{browser}</td>
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
                    <td>{ip}</td>
                    <td>{count}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
