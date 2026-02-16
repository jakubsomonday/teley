<template>
  <div class="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
    <!-- Header -->
    <div class="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
      <div class="flex justify-between items-center">
        <div>
          <h2
            class="text-xl font-semibold text-zinc-100 inline-flex items-baseline gap-1.5"
          >
            Logs

            <button
              @click="setupGuideDialog?.open()"
              class="hover:text-zinc-300 text-zinc-500 transition-colors translate-y-0.5"
              title="Setup guide"
            >
              <IconPhQuestion class="w-4 h-4" />
            </button>
          </h2>
          <p class="text-sm text-zinc-400 mt-1">
            Real-time log monitoring (showing last 500 logs)
          </p>
        </div>

        <div class="flex items-center gap-3">
          <!-- Attribute filter -->
          <div class="flex items-center gap-2">
            <input
              v-model="filterQuery"
              type="text"
              placeholder="Filter attributes (key=value)"
              class="h-8 w-64 px-2 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <span
              v-if="debouncedFilter"
              class="text-xs text-zinc-400 whitespace-nowrap"
            >
              {{ filteredLogs.length }} of {{ logs.length }} logs
            </span>
          </div>

          <!-- RemoteTap controls -->
          <div class="flex items-center gap-2">
            <!-- Status dot -->
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :class="{
                'bg-green-500': remoteTap.status === 'connected',
                'bg-yellow-500 animate-pulse': remoteTap.status === 'connecting',
                'bg-red-500': remoteTap.status === 'error',
                'bg-zinc-600': remoteTap.status === 'disconnected',
              }"
              :title="`RemoteTap: ${remoteTap.status}`"
            />

            <!-- URL input (when disconnected or error) -->
            <input
              v-if="remoteTap.status === 'disconnected' || remoteTap.status === 'error'"
              v-model="remoteTapUrl"
              type="text"
              placeholder="ws://host:port/path"
              class="h-8 w-56 px-2 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              @keydown.enter="handleRemoteTapConnect"
            />

            <!-- Connected URL display -->
            <span
              v-else
              class="text-xs text-zinc-400 max-w-56 truncate"
              :title="remoteTap.url ?? ''"
            >
              {{ remoteTap.url }}
            </span>

            <!-- Connect / Disconnect button -->
            <button
              v-if="remoteTap.status === 'disconnected' || remoteTap.status === 'error'"
              @click="handleRemoteTapConnect"
              :disabled="remoteTapLoading || !remoteTapUrl"
              class="h-8 px-3 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect
            </button>
            <button
              v-else
              @click="handleRemoteTapDisconnect"
              :disabled="remoteTapLoading"
              class="h-8 px-3 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disconnect
            </button>

            <!-- Error message -->
            <span
              v-if="remoteTap.status === 'error' && remoteTap.error"
              class="text-xs text-red-400 max-w-40 truncate"
              :title="remoteTap.error"
            >
              {{ remoteTap.error }}
            </span>
          </div>

          <button
            v-if="logs.length > 0"
            @click="handleClearLogs"
            class="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
            title="Clear all logs"
          >
            <IconPhTrash class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Logs Table -->
    <div class="flex-1 overflow-y-auto" style="scrollbar-gutter: stable">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="text-center space-y-3">
          <div
            class="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto"
          ></div>
          <p class="text-sm text-zinc-400">Loading logs...</p>
        </div>
      </div>

      <div v-else-if="error" class="flex items-center justify-center h-full">
        <div
          class="text-center space-y-3 max-w-md px-8 py-6 bg-red-500/10 border border-red-500/20 rounded-lg"
        >
          <p class="text-sm text-red-400">{{ error }}</p>
        </div>
      </div>

      <div
        v-else-if="logs.length === 0"
        class="flex items-center justify-center h-full"
      >
        <div class="text-center space-y-6 max-w-md px-8">
          <div
            class="w-32 h-32 mx-auto bg-zinc-900 rounded-3xl flex items-center justify-center relative overflow-hidden"
          >
            <div
              class="absolute inset-0 bg-gradient-to-br from-zinc-800/50 via-zinc-900 to-zinc-950"
            />
            <IconPhLog class="w-16 h-16 text-zinc-700 relative z-10" />
          </div>
          <div class="space-y-3">
            <h3 class="text-xl font-semibold text-zinc-300">No logs yet</h3>
            <p class="text-sm text-zinc-500 leading-relaxed">
              Logs will appear here as they are received via OTLP
            </p>
          </div>
          <button
            @click="setupGuideDialog?.open()"
            class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <IconPhBookOpenText class="w-4 h-4" />
            Setup Guide
          </button>
        </div>
      </div>

      <div
        v-else-if="filteredLogs.length === 0"
        class="flex items-center justify-center h-full"
      >
        <div class="text-center space-y-4 max-w-md px-8">
          <p class="text-sm text-zinc-400">
            No logs match your filter across {{ logs.length }} loaded logs.
          </p>
          <button
            @click="handleLoadMore"
            :disabled="loadingMore"
            class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div
              v-if="loadingMore"
              class="w-4 h-4 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin"
            />
            <template v-else>Load more logs</template>
          </button>
        </div>
      </div>

      <table v-else class="w-full">
        <tbody>
          <LogRow
            v-for="log in filteredLogs"
            :key="log.log_id"
            :log="log"
            :is-expanded="expandedLogs.has(log.log_id)"
            @toggle-expanded="toggleLogExpansion(log.log_id)"
          />
        </tbody>
      </table>
    </div>

    <!-- Setup Guide Modal -->
    <ModalDialog ref="setupGuideDialog" title="Logs Setup Guide" size="large">
      <LogsSetupGuide />
    </ModalDialog>

    <ClearLogsDialog
      confirm-text="Clear All"
      cancel-text="Cancel"
      variant="danger"
    />
  </div>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import type { Log } from '@types';

const { logs, loading, error, fetchLogs, clearLogs } = useLogs();
const {
  state: remoteTap,
  loading: remoteTapLoading,
  connect: connectRemoteTap,
  disconnect: disconnectRemoteTap,
  fetchStatus: fetchRemoteTapStatus,
} = useRemoteTap();

const remoteTapUrl = ref('');

const filterQuery = ref('');
const debouncedFilter = refDebounced(filterQuery, 200);

const filteredLogs = computed(() => {
  const query = debouncedFilter.value.trim();
  if (!query) return logs.value;

  const terms = query.split(/\s+/);

  return logs.value.filter((log: Log) => {
    let attrs: Record<string, unknown>;
    try {
      attrs = JSON.parse(log.attributes);
    } catch {
      return false;
    }

    return terms.every((term) => {
      const eqIndex = term.indexOf('=');
      if (eqIndex !== -1) {
        const key = term.slice(0, eqIndex);
        const value = term.slice(eqIndex + 1).toLowerCase();
        return (
          key in attrs && String(attrs[key]).toLowerCase().includes(value)
        );
      } else {
        const lower = term.toLowerCase();
        return Object.entries(attrs).some(
          ([k, v]) =>
            k.toLowerCase().includes(lower) ||
            String(v).toLowerCase().includes(lower),
        );
      }
    });
  });
});

const loadingMore = ref(false);
const currentLimit = ref(500);

async function handleLoadMore() {
  loadingMore.value = true;
  try {
    currentLimit.value += 500;
    await fetchLogs(currentLimit.value);
  } finally {
    loadingMore.value = false;
  }
}

const expandedLogs = ref<Set<string>>(new Set());
const setupGuideDialog = ref<{ open: () => void; close: () => void } | null>(
  null,
);

const [ClearLogsDialog, confirmClearLogs] = useConfirmation(async () => {
  await clearLogs();
  expandedLogs.value.clear();
});

function toggleLogExpansion(logId: string) {
  if (expandedLogs.value.has(logId)) {
    expandedLogs.value.delete(logId);
  } else {
    expandedLogs.value.add(logId);
  }
}

function handleClearLogs() {
  confirmClearLogs(
    'Clear All Logs',
    'Are you sure you want to clear all log data? This action cannot be undone.',
  );
}

function handleRemoteTapConnect() {
  if (remoteTapUrl.value) {
    connectRemoteTap(remoteTapUrl.value);
  }
}

function handleRemoteTapDisconnect() {
  disconnectRemoteTap();
}

// Fetch logs and remotetap status on mount
onMounted(() => {
  fetchLogs();
  fetchRemoteTapStatus();
});
</script>
