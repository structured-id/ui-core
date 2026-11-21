<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="col">
        <h5 class="q-my-none">Webhooks & Events</h5>
        <p class="text-caption text-grey q-mb-none">
          Manage webhook endpoints, monitor deliveries, and browse the event
          catalog.
        </p>
      </div>
    </div>

    <q-banner v-if="store.error" type="negative" class="q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <q-tabs
      v-model="tab"
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="q-mb-md"
    >
      <q-tab name="endpoints" icon="sym_o_webhook" label="Endpoints" />
      <q-tab name="deliveries" icon="sym_o_send" label="Delivery Monitor" />
      <q-tab name="catalog" icon="sym_o_category" label="Event Catalog" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated>
      <!-- ═══ Tab 1: Endpoints ═══ -->
      <q-tab-panel name="endpoints" class="q-pa-none">
        <!-- Filters + Create -->
        <div class="row items-end q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-3">
            <q-input
              v-model="endpointSearch"
              label="Search endpoints"
              dense
              outlined
              clearable
              debounce="300"
              @update:model-value="loadEndpoints"
            >
              <template #prepend>
                <q-icon name="sym_o_search" />
              </template>
            </q-input>
          </div>
          <div class="col-12 col-sm-2">
            <q-select
              v-model="endpointStatusFilter"
              label="Status"
              :options="endpointStatusOptions"
              dense
              outlined
              clearable
              emit-value
              map-options
              @update:model-value="loadEndpoints"
            />
          </div>
          <q-space />
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="sym_o_add"
              label="Create Endpoint"
              @click="showCreateDialog = true"
            />
          </div>
        </div>

        <!-- Endpoints Table -->
        <q-card flat bordered>
          <q-table
            :rows="store.endpoints"
            :columns="endpointColumns"
            row-key="endpointId"
            :loading="store.loading"
            flat
            :pagination="{ rowsPerPage: 25 }"
          >
            <template #body-cell-name="props">
              <q-td :props="props">
                <div class="text-weight-medium">{{ props.row.name }}</div>
                <div
                  class="text-caption text-grey"
                  style="
                    max-width: 300px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  "
                >
                  {{ props.row.url }}
                </div>
              </q-td>
            </template>

            <template #body-cell-status="props">
              <q-td :props="props">
                <q-chip
                  dense
                  size="sm"
                  :icon="endpointStatusIcon(props.row.status)"
                  :color="endpointStatusColor(props.row.status)"
                  text-color="white"
                  :label="endpointStatusLabel(props.row.status)"
                />
              </q-td>
            </template>

            <template #body-cell-subscriptionMode="props">
              <q-td :props="props">
                <span class="text-caption">
                  {{ subscriptionModeLabel(props.row.subscriptionMode) }}
                </span>
                <q-badge
                  v-if="props.row.subscribedEventCount > 0"
                  color="grey-6"
                  class="q-ml-xs"
                >
                  {{ props.row.subscribedEventCount }}
                </q-badge>
              </q-td>
            </template>

            <template #body-cell-deliveryRate="props">
              <q-td :props="props">
                <span
                  :class="
                    props.row.deliveryRate24H >= 95
                      ? 'text-positive'
                      : props.row.deliveryRate24H >= 80
                        ? 'text-warning'
                        : 'text-negative'
                  "
                >
                  {{ props.row.deliveryRate24H.toFixed(1) }}%
                </span>
              </q-td>
            </template>

            <template #body-cell-dlqDepth="props">
              <q-td :props="props">
                <q-badge
                  v-if="props.row.dlqDepth > 0"
                  color="purple"
                  :label="props.row.dlqDepth"
                />
                <span v-else class="text-grey">0</span>
              </q-td>
            </template>

            <template #body-cell-lastDelivery="props">
              <q-td :props="props">
                <div v-if="props.row.lastDeliveryAt">
                  {{ formatTimestamp(props.row.lastDeliveryAt) }}
                  <q-badge
                    v-if="props.row.lastDeliveryStatusCode"
                    :color="
                      props.row.lastDeliveryStatusCode < 300
                        ? 'positive'
                        : 'negative'
                    "
                    :label="props.row.lastDeliveryStatusCode"
                    class="q-ml-xs"
                  />
                </div>
                <span v-else class="text-grey">Never</span>
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props">
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="sym_o_visibility"
                  @click="viewEndpoint(props.row.endpointId)"
                >
                  <q-tooltip>View Details</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="props.row.status === EndpointStatus.ACTIVE"
                  flat
                  dense
                  round
                  size="sm"
                  icon="sym_o_pause"
                  color="warning"
                  @click="handlePause(props.row.endpointId)"
                >
                  <q-tooltip>Pause</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="props.row.status === EndpointStatus.PAUSED"
                  flat
                  dense
                  round
                  size="sm"
                  icon="sym_o_play_arrow"
                  color="positive"
                  @click="handleResume(props.row.endpointId)"
                >
                  <q-tooltip>Resume</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="sym_o_delete"
                  color="negative"
                  @click="handleDelete(props.row.endpointId, props.row.name)"
                >
                  <q-tooltip>Delete</q-tooltip>
                </q-btn>
              </q-td>
            </template>

            <template #no-data>
              <div class="full-width text-center q-pa-xl">
                <q-icon name="sym_o_webhook" size="64px" color="grey-4" />
                <div class="text-h6 text-grey-6 q-mt-md">
                  No webhook endpoints
                </div>
                <div class="text-caption text-grey">
                  Create an endpoint to start receiving events.
                </div>
              </div>
            </template>
          </q-table>
        </q-card>
      </q-tab-panel>

      <!-- ═══ Tab 2: Delivery Monitor ═══ -->
      <q-tab-panel name="deliveries" class="q-pa-none">
        <!-- Analytics Cards -->
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-6 col-sm-2">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">Deliveries (24h)</div>
                <div class="text-h5">
                  {{ store.analytics?.totalDeliveries24H ?? "—" }}
                </div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-6 col-sm-2">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">Success Rate</div>
                <div class="text-h5" :class="successRateClass">
                  {{
                    store.analytics
                      ? `${(store.analytics.successRate * 100).toFixed(1)}%`
                      : "—"
                  }}
                </div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-6 col-sm-2">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">Avg Latency</div>
                <div class="text-h5">
                  {{
                    store.analytics ? `${store.analytics.avgLatencyMs}ms` : "—"
                  }}
                </div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-6 col-sm-2">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">DLQ Depth</div>
                <div
                  class="text-h5"
                  :class="store.analytics?.dlqDepth ? 'text-purple' : ''"
                >
                  {{ store.analytics?.dlqDepth ?? "—" }}
                </div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-6 col-sm-2">
            <q-card flat bordered>
              <q-card-section class="q-pa-sm text-center">
                <div class="text-caption text-grey">Active Endpoints</div>
                <div class="text-h5">
                  {{
                    store.analytics
                      ? `${store.analytics.activeEndpoints}/${store.analytics.totalEndpoints}`
                      : "—"
                  }}
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Delivery Filters -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="row q-col-gutter-sm items-end">
              <div class="col-12 col-sm-3">
                <q-select
                  v-model="deliveryEndpointId"
                  label="Endpoint"
                  :options="endpointOptions"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  @update:model-value="loadDeliveries"
                />
              </div>
              <div class="col-12 col-sm-2">
                <q-select
                  v-model="deliveryStatusFilter"
                  label="Status"
                  :options="deliveryStatusOptions"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  @update:model-value="loadDeliveries"
                />
              </div>
              <div class="col-12 col-sm-3">
                <q-input
                  v-model="deliveryEventTypeFilter"
                  label="Event Type"
                  dense
                  outlined
                  clearable
                  @update:model-value="loadDeliveries"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Deliveries Table -->
        <q-card flat bordered>
          <q-table
            :rows="store.deliveries"
            :columns="deliveryColumns"
            row-key="deliveryId"
            :loading="store.loading"
            flat
            :pagination="{ rowsPerPage: 25 }"
          >
            <template #body-cell-status="props">
              <q-td :props="props">
                <q-chip
                  dense
                  size="sm"
                  :color="deliveryStatusColor(props.row.status)"
                  text-color="white"
                  :label="deliveryStatusLabel(props.row.status)"
                />
              </q-td>
            </template>

            <template #body-cell-httpStatus="props">
              <q-td :props="props">
                <q-badge
                  v-if="props.row.httpStatusCode"
                  :color="
                    props.row.httpStatusCode < 300 ? 'positive' : 'negative'
                  "
                  :label="props.row.httpStatusCode"
                />
                <span v-else class="text-grey">—</span>
              </q-td>
            </template>

            <template #body-cell-attempts="props">
              <q-td :props="props">
                {{ props.row.attempt }}/{{ props.row.maxAttempts }}
              </q-td>
            </template>

            <template #body-cell-nextRetry="props">
              <q-td :props="props">
                <span v-if="props.row.nextRetryAt">{{
                  formatTimestamp(props.row.nextRetryAt)
                }}</span>
                <span v-else class="text-grey">—</span>
              </q-td>
            </template>

            <template #body-cell-timestamp="props">
              <q-td :props="props">
                {{ formatTimestamp(props.row.timestamp) }}
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props">
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="sym_o_visibility"
                  @click="viewDelivery(props.row)"
                >
                  <q-tooltip>View Detail</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="
                    props.row.status === DeliveryStatus.FAILED ||
                    props.row.status === DeliveryStatus.DLQ
                  "
                  flat
                  dense
                  round
                  size="sm"
                  icon="sym_o_replay"
                  color="primary"
                  @click="handleRedeliver(props.row)"
                >
                  <q-tooltip>Redeliver</q-tooltip>
                </q-btn>
              </q-td>
            </template>

            <template #no-data>
              <div class="full-width text-center q-pa-xl">
                <q-icon name="sym_o_send" size="64px" color="grey-4" />
                <div class="text-h6 text-grey-6 q-mt-md">No deliveries</div>
                <div class="text-caption text-grey">
                  Select an endpoint and check delivery history.
                </div>
              </div>
            </template>
          </q-table>
          <div v-if="store.deliveriesNextToken" class="text-center q-pa-sm">
            <q-btn flat no-caps label="Load more" @click="moreDeliveries" />
          </div>
        </q-card>

        <!-- Delivery Detail Dialog -->
        <q-dialog v-model="showDeliveryDetail" maximized>
          <q-card v-if="store.deliveryDetail">
            <q-card-section class="row items-center">
              <div class="text-h6">Delivery Detail</div>
              <q-space />
              <q-btn flat round icon="sym_o_close" v-close-popup />
            </q-card-section>
            <q-separator />
            <q-card-section
              class="scroll"
              style="max-height: calc(100vh - 100px)"
            >
              <!-- Summary -->
              <div class="row q-col-gutter-md q-mb-md">
                <div class="col-6 col-sm-3">
                  <div class="text-caption text-grey">Event ID</div>
                  <div class="text-body2">
                    {{ store.deliveryDetail.summary?.eventId }}
                  </div>
                </div>
                <div class="col-6 col-sm-3">
                  <div class="text-caption text-grey">Event Type</div>
                  <div class="text-body2">
                    {{ store.deliveryDetail.summary?.eventType }}
                  </div>
                </div>
                <div class="col-6 col-sm-3">
                  <div class="text-caption text-grey">Status</div>
                  <q-chip
                    dense
                    size="sm"
                    :color="
                      deliveryStatusColor(
                        store.deliveryDetail.summary?.status ??
                          DeliveryStatus.UNSPECIFIED,
                      )
                    "
                    text-color="white"
                    :label="
                      deliveryStatusLabel(
                        store.deliveryDetail.summary?.status ??
                          DeliveryStatus.UNSPECIFIED,
                      )
                    "
                  />
                </div>
                <div class="col-6 col-sm-3">
                  <div class="text-caption text-grey">Latency</div>
                  <div class="text-body2">
                    {{ store.deliveryDetail.summary?.latencyMs }}ms
                  </div>
                </div>
              </div>

              <!-- Request -->
              <div class="text-subtitle2 q-mb-sm">Request</div>
              <q-card flat bordered class="q-mb-md">
                <q-card-section>
                  <div class="text-caption text-grey q-mb-xs">Headers</div>
                  <pre
                    class="text-body2 bg-grey-2 q-pa-sm"
                    style="overflow-x: auto; border-radius: 4px"
                    >{{
                      formatHeaders(store.deliveryDetail.requestHeaders)
                    }}</pre>
                  <div class="text-caption text-grey q-mt-md q-mb-xs">Body</div>
                  <pre
                    class="text-body2 bg-grey-2 q-pa-sm"
                    style="
                      overflow-x: auto;
                      border-radius: 4px;
                      max-height: 300px;
                    "
                    >{{ formatJson(store.deliveryDetail.requestBody) }}</pre>
                </q-card-section>
              </q-card>

              <!-- Response -->
              <div class="text-subtitle2 q-mb-sm">Response</div>
              <q-card flat bordered class="q-mb-md">
                <q-card-section>
                  <div class="text-caption text-grey q-mb-xs">Headers</div>
                  <pre
                    class="text-body2 bg-grey-2 q-pa-sm"
                    style="overflow-x: auto; border-radius: 4px"
                    >{{
                      formatHeaders(store.deliveryDetail.responseHeaders)
                    }}</pre>
                  <div class="text-caption text-grey q-mt-md q-mb-xs">Body</div>
                  <pre
                    class="text-body2 bg-grey-2 q-pa-sm"
                    style="
                      overflow-x: auto;
                      border-radius: 4px;
                      max-height: 300px;
                    "
                    >{{ formatJson(store.deliveryDetail.responseBody) }}</pre>
                </q-card-section>
              </q-card>

              <!-- Attempts Timeline -->
              <div
                v-if="store.deliveryDetail.attempts.length > 0"
                class="text-subtitle2 q-mb-sm"
              >
                Attempts
              </div>
              <q-timeline
                v-if="store.deliveryDetail.attempts.length > 0"
                color="grey"
              >
                <q-timeline-entry
                  v-for="attempt in store.deliveryDetail.attempts"
                  :key="attempt.attemptNumber"
                  :color="deliveryStatusColor(attempt.status)"
                  :icon="
                    attempt.status === DeliveryStatus.DELIVERED
                      ? 'sym_o_check'
                      : 'sym_o_close'
                  "
                >
                  <template #title>
                    Attempt #{{ attempt.attemptNumber }}
                    <q-badge
                      :color="
                        attempt.httpStatusCode < 300 ? 'positive' : 'negative'
                      "
                      :label="attempt.httpStatusCode"
                      class="q-ml-sm"
                    />
                    <span class="text-caption text-grey q-ml-sm"
                      >{{ attempt.latencyMs }}ms</span
                    >
                  </template>
                  <template #subtitle>
                    {{ formatTimestamp(attempt.timestamp) }}
                  </template>
                  <div
                    v-if="attempt.errorMessage"
                    class="text-negative text-caption"
                  >
                    {{ attempt.errorMessage }}
                  </div>
                </q-timeline-entry>
              </q-timeline>
            </q-card-section>
          </q-card>
        </q-dialog>
      </q-tab-panel>

      <!-- ═══ Tab 3: Event Catalog ═══ -->
      <q-tab-panel name="catalog" class="q-pa-none">
        <div class="row q-col-gutter-md">
          <!-- Event Types List -->
          <div class="col-12 col-md-5">
            <q-input
              v-model="catalogDomainFilter"
              label="Filter by domain"
              dense
              outlined
              clearable
              class="q-mb-md"
              @update:model-value="loadEventTypes"
            >
              <template #prepend>
                <q-icon name="sym_o_filter_list" />
              </template>
            </q-input>

            <q-card flat bordered>
              <q-list separator>
                <q-item
                  v-for="ev in store.eventTypes"
                  :key="ev.eventType"
                  clickable
                  v-ripple
                  :active="selectedEventType === ev.eventType"
                  active-class="bg-blue-1 text-primary"
                  @click="selectEventType(ev.eventType)"
                >
                  <q-item-section avatar>
                    <q-icon name="sym_o_bolt" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ ev.eventType }}</q-item-label>
                    <q-item-label caption>{{ ev.description }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge
                      color="grey-6"
                      :label="`${ev.subscriberCount} sub`"
                    />
                  </q-item-section>
                </q-item>

                <q-item v-if="store.eventTypes.length === 0 && !store.loading">
                  <q-item-section class="text-center text-grey q-pa-md">
                    No event types found
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>

          <!-- Event Detail Panel -->
          <div class="col-12 col-md-7">
            <q-card v-if="store.eventDetail" flat bordered>
              <q-card-section>
                <div class="text-h6">{{ store.eventDetail.eventType }}</div>
                <div class="text-caption text-grey">
                  {{ store.eventDetail.domain }}
                </div>
                <p class="q-mt-sm">{{ store.eventDetail.description }}</p>
              </q-card-section>

              <q-separator />

              <!-- Trigger Conditions -->
              <q-card-section
                v-if="store.eventDetail.triggerConditions.length > 0"
              >
                <div class="text-subtitle2 q-mb-sm">Trigger Conditions</div>
                <q-list dense>
                  <q-item
                    v-for="(cond, i) in store.eventDetail.triggerConditions"
                    :key="i"
                    dense
                  >
                    <q-item-section avatar>
                      <q-icon name="sym_o_chevron_right" size="xs" />
                    </q-item-section>
                    <q-item-section>{{ cond }}</q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>

              <q-separator />

              <!-- Payload Schema -->
              <q-card-section v-if="store.eventDetail.payloadSchema">
                <div class="text-subtitle2 q-mb-sm">Payload Schema</div>
                <pre
                  class="text-body2 bg-grey-2 q-pa-sm"
                  style="
                    overflow-x: auto;
                    border-radius: 4px;
                    max-height: 300px;
                  "
                  >{{ formatJson(store.eventDetail.payloadSchema) }}</pre>
              </q-card-section>

              <q-separator />

              <!-- Example Payload -->
              <q-card-section v-if="store.eventDetail.examplePayload">
                <div class="text-subtitle2 q-mb-sm">Example Payload</div>
                <pre
                  class="text-body2 bg-grey-2 q-pa-sm"
                  style="
                    overflow-x: auto;
                    border-radius: 4px;
                    max-height: 300px;
                  "
                  >{{ formatJson(store.eventDetail.examplePayload) }}</pre>
              </q-card-section>

              <q-separator />

              <!-- Related Types -->
              <q-card-section v-if="store.eventDetail.relatedTypes.length > 0">
                <div class="text-subtitle2 q-mb-sm">Related Events</div>
                <q-chip
                  v-for="rt in store.eventDetail.relatedTypes"
                  :key="rt"
                  clickable
                  outline
                  color="primary"
                  size="sm"
                  :label="rt"
                  @click="selectEventType(rt)"
                />
              </q-card-section>

              <q-separator />

              <!-- Test Event -->
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">Send Test Event</div>
                <div class="row q-col-gutter-sm items-end">
                  <div class="col-12 col-sm-5">
                    <q-select
                      v-model="testEndpointId"
                      label="Target Endpoint"
                      :options="endpointOptions"
                      dense
                      outlined
                      emit-value
                      map-options
                    />
                  </div>
                  <div class="col-auto">
                    <q-btn
                      color="primary"
                      label="Send Test"
                      icon="sym_o_send"
                      :disable="!testEndpointId"
                      :loading="sendingTest"
                      @click="handleSendTest"
                    />
                  </div>
                </div>
                <q-banner
                  v-if="testResult"
                  class="q-mt-sm"
                  rounded
                  :class="
                    testResult.httpStatusCode < 300 ? 'bg-green-1' : 'bg-red-1'
                  "
                >
                  <div class="row items-center q-gutter-sm">
                    <q-badge
                      :color="
                        testResult.httpStatusCode < 300
                          ? 'positive'
                          : 'negative'
                      "
                      :label="testResult.httpStatusCode"
                    />
                    <span class="text-caption"
                      >{{ testResult.latencyMs }}ms</span
                    >
                    <span class="text-caption">{{
                      deliveryStatusLabel(testResult.status)
                    }}</span>
                  </div>
                  <pre
                    v-if="testResult.responseBody"
                    class="text-body2 bg-grey-2 q-pa-xs q-mt-xs"
                    style="
                      border-radius: 4px;
                      max-height: 150px;
                      overflow: auto;
                    "
                    >{{ formatJson(testResult.responseBody) }}</pre>
                </q-banner>
              </q-card-section>

              <!-- Subscribed Endpoints -->
              <q-separator />
              <q-card-section
                v-if="store.eventDetail.subscribedEndpoints.length > 0"
              >
                <div class="text-subtitle2 q-mb-sm">Subscribed Endpoints</div>
                <q-chip
                  v-for="ep in store.eventDetail.subscribedEndpoints"
                  :key="ep"
                  outline
                  size="sm"
                  icon="sym_o_webhook"
                  :label="ep"
                />
              </q-card-section>
            </q-card>

            <q-card v-else flat bordered class="text-center q-pa-xl">
              <q-icon name="sym_o_category" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">
                Select an event type
              </div>
              <div class="text-caption text-grey">
                Choose an event type from the list to view details.
              </div>
            </q-card>
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- ═══ Create Endpoint Dialog ═══ -->
    <q-dialog v-model="showCreateDialog" persistent>
      <q-card style="min-width: 550px">
        <q-card-section>
          <div class="text-h6">Create Webhook Endpoint</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="createForm.name"
            label="Name"
            outlined
            dense
            class="q-mb-sm"
            :rules="[(v) => !!v || 'Required']"
          />
          <q-input
            v-model="createForm.url"
            label="URL"
            outlined
            dense
            class="q-mb-sm"
            :rules="[
              (v) => !!v || 'Required',
              (v) => v.startsWith('https://') || 'Must use HTTPS',
            ]"
          />
          <q-input
            v-model="createForm.description"
            label="Description"
            outlined
            dense
            class="q-mb-sm"
            type="textarea"
            autogrow
          />

          <q-select
            v-model="createForm.subscriptionMode"
            label="Subscription Mode"
            :options="subscriptionModeOptions"
            outlined
            dense
            emit-value
            map-options
            class="q-mb-sm"
          />

          <q-select
            v-if="createForm.subscriptionMode === SubscriptionMode.SELECTED"
            v-model="createForm.subscribedEventTypes"
            label="Event Types"
            :options="store.eventTypes.map((e) => e.eventType)"
            outlined
            dense
            multiple
            use-chips
            class="q-mb-sm"
          />

          <q-input
            v-if="createForm.subscriptionMode === SubscriptionMode.PATTERN"
            v-model="createForm.eventPattern"
            label="Event Pattern (glob)"
            outlined
            dense
            hint="e.g. sid.identity.* or sid.auth.**"
            class="q-mb-sm"
          />

          <div class="row q-col-gutter-sm q-mb-sm">
            <div class="col-6">
              <q-input
                v-model.number="createForm.timeoutSeconds"
                label="Timeout (sec)"
                outlined
                dense
                type="number"
                :rules="[(v) => v > 0 || 'Must be positive']"
              />
            </div>
            <div class="col-6">
              <q-input
                v-model.number="createForm.maxRetries"
                label="Max Retries"
                outlined
                dense
                type="number"
              />
            </div>
          </div>

          <q-input
            v-model.number="createForm.autoDisableThreshold"
            label="Auto-disable after N failures (0 = never)"
            outlined
            dense
            type="number"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            :loading="store.saving"
            @click="handleCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ═══ HMAC Secret Dialog ═══ -->
    <q-dialog v-model="showSecretDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">HMAC Signing Secret</div>
        </q-card-section>
        <q-card-section>
          <q-banner class="bg-orange-1 q-mb-md" rounded>
            <template #avatar>
              <q-icon name="sym_o_warning" color="orange" />
            </template>
            This secret is shown only once. Copy it now.
          </q-banner>
          <q-input :model-value="store.hmacSecret" outlined readonly dense>
            <template #append>
              <q-btn flat dense icon="sym_o_content_copy" @click="copySecret">
                <q-tooltip>Copy</q-tooltip>
              </q-btn>
            </template>
          </q-input>
          <div class="text-caption text-grey q-mt-sm">
            Use this secret to verify webhook signatures via
            <code
              >X-SID-Signature: t=&lt;timestamp&gt;,v1=&lt;hmac-sha256&gt;</code
            >
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Done" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useWebhooksStore } from "#admin/stores/webhooks";
import {
  EndpointStatus,
  DeliveryStatus,
  SubscriptionMode,
} from "@structured-id/proto/sid/v1/admin/webhooks";
import type {
  DeliverySummary,
  SendTestEventResponse,
} from "@structured-id/proto/sid/v1/admin/webhooks";
import type { Timestamp } from "@structured-id/proto/google/protobuf/timestamp";
import {
  endpointStatusLabel,
  endpointStatusColor,
  endpointStatusIcon,
  deliveryStatusLabel,
  deliveryStatusColor,
  subscriptionModeLabel,
} from "#admin/composables/useEnumLabels";
import { useQuasar, copyToClipboard } from "quasar";

const $q = useQuasar();
const store = useWebhooksStore();

const tab = ref("endpoints");

// ── Endpoint state ──
const endpointSearch = ref("");
const endpointStatusFilter = ref<EndpointStatus | null>(null);
const showCreateDialog = ref(false);
const showSecretDialog = ref(false);

const endpointStatusOptions = [
  { label: "Active", value: EndpointStatus.ACTIVE },
  { label: "Paused", value: EndpointStatus.PAUSED },
  { label: "Failing", value: EndpointStatus.FAILING },
  { label: "Disabled", value: EndpointStatus.DISABLED },
];

const createForm = reactive({
  name: "",
  url: "",
  description: "",
  subscriptionMode: SubscriptionMode.ALL,
  subscribedEventTypes: [] as string[],
  eventPattern: "",
  timeoutSeconds: 30,
  maxRetries: 5,
  autoDisableThreshold: 0,
});

const subscriptionModeOptions = [
  { label: "All Events", value: SubscriptionMode.ALL },
  { label: "Selected Types", value: SubscriptionMode.SELECTED },
  { label: "Pattern Match", value: SubscriptionMode.PATTERN },
];

// ── Delivery state ──
const deliveryEndpointId = ref<string | null>(null);
const deliveryStatusFilter = ref<DeliveryStatus | null>(null);
const deliveryEventTypeFilter = ref("");
const showDeliveryDetail = ref(false);

const deliveryStatusOptions = [
  { label: "Delivered", value: DeliveryStatus.DELIVERED },
  { label: "Failed", value: DeliveryStatus.FAILED },
  { label: "Timeout", value: DeliveryStatus.TIMEOUT },
  { label: "Retrying", value: DeliveryStatus.RETRYING },
  { label: "Dead Letter Queue", value: DeliveryStatus.DLQ },
];

// ── Catalog state ──
const catalogDomainFilter = ref("");
const selectedEventType = ref<string | null>(null);
const testEndpointId = ref<string | null>(null);
const sendingTest = ref(false);
const testResult = ref<SendTestEventResponse | null>(null);

// ── Computed ──

const endpointOptions = computed(() =>
  store.endpoints.map((e) => ({ label: e.name, value: e.endpointId })),
);

const successRateClass = computed(() => {
  const rate = store.analytics?.successRate ?? 0;
  if (rate >= 0.95) return "text-positive";
  if (rate >= 0.8) return "text-warning";
  return "text-negative";
});

// ── Table columns ──

const endpointColumns = [
  {
    name: "name",
    label: "Endpoint",
    field: "name",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "center" as const,
  },
  {
    name: "subscriptionMode",
    label: "Subscription",
    field: "subscriptionMode",
    align: "left" as const,
  },
  {
    name: "deliveryRate",
    label: "Success (24h)",
    field: "deliveryRate24H",
    align: "center" as const,
    sortable: true,
  },
  {
    name: "dlqDepth",
    label: "DLQ",
    field: "dlqDepth",
    align: "center" as const,
    sortable: true,
  },
  {
    name: "lastDelivery",
    label: "Last Delivery",
    field: "lastDeliveryAt",
    align: "left" as const,
  },
  { name: "actions", label: "", field: "actions", align: "right" as const },
];

const deliveryColumns = [
  {
    name: "eventType",
    label: "Event Type",
    field: "eventType",
    align: "left" as const,
    sortable: true,
  },
  {
    name: "eventId",
    label: "Event ID",
    field: "eventId",
    align: "left" as const,
    style: "max-width: 120px; overflow: hidden; text-overflow: ellipsis",
  },
  {
    name: "status",
    label: "Status",
    field: "status",
    align: "center" as const,
  },
  {
    name: "httpStatus",
    label: "HTTP",
    field: "httpStatusCode",
    align: "center" as const,
  },
  {
    name: "latency",
    label: "Latency",
    field: "latencyMs",
    align: "center" as const,
    sortable: true,
    format: (v: number) => `${v}ms`,
  },
  {
    name: "attempts",
    label: "Attempts",
    field: "attempt",
    align: "center" as const,
  },
  {
    name: "nextRetry",
    label: "Next Retry",
    field: "nextRetryAt",
    align: "left" as const,
  },
  {
    name: "timestamp",
    label: "Timestamp",
    field: "timestamp",
    align: "left" as const,
    sortable: true,
  },
  { name: "actions", label: "", field: "actions", align: "right" as const },
];

// ── Helpers ──

function formatTimestamp(ts?: Timestamp): string {
  if (!ts) return "—";
  return new Date(Number(ts.seconds) * 1000).toLocaleString();
}

function formatHeaders(headers: Record<string, string>): string {
  return (
    Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n") || "(none)"
  );
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// ── Actions ──

function loadEndpoints() {
  store.fetchEndpoints(
    endpointStatusFilter.value ?? undefined,
    endpointSearch.value || undefined,
  );
}

// A delivery search keeps the endpoint and filters it ran with: "Load
// more" continues that search, not whatever the fields hold now.
let deliveryQuery: {
  endpointId: string;
  status?: DeliveryStatus;
  eventType?: string;
} | null = null;

function loadDeliveries() {
  if (!deliveryEndpointId.value) return;
  deliveryQuery = {
    endpointId: deliveryEndpointId.value,
    status: deliveryStatusFilter.value ?? undefined,
    eventType: deliveryEventTypeFilter.value || undefined,
  };
  const { endpointId, ...filters } = deliveryQuery;
  store.fetchDeliveries(endpointId, filters);
}

function moreDeliveries() {
  if (!deliveryQuery) return;
  const { endpointId, ...filters } = deliveryQuery;
  store.fetchDeliveries(endpointId, {
    ...filters,
    pageToken: store.deliveriesNextToken,
  });
}

function loadEventTypes() {
  store.fetchEventTypes(catalogDomainFilter.value || undefined);
}

function viewEndpoint(endpointId: string) {
  store.fetchEndpoint(endpointId);
  // Future: could open detail dialog/page
}

async function handlePause(endpointId: string) {
  try {
    await store.pauseEndpoint(endpointId);
    $q.notify({ type: "positive", message: "Endpoint paused" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

async function handleResume(endpointId: string) {
  try {
    await store.resumeEndpoint(endpointId);
    $q.notify({ type: "positive", message: "Endpoint resumed" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

function handleDelete(endpointId: string, name: string) {
  $q.dialog({
    title: "Delete Endpoint",
    message: `Delete webhook endpoint "${name}"? This cannot be undone.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await store.deleteEndpoint(endpointId);
      $q.notify({ type: "positive", message: "Endpoint deleted" });
    } catch {
      $q.notify({ type: "negative", message: store.error ?? "Failed" });
    }
  });
}

async function handleCreate() {
  if (!createForm.name || !createForm.url) return;
  try {
    await store.createEndpoint({
      name: createForm.name,
      url: createForm.url,
      description: createForm.description,
      subscriptionMode: createForm.subscriptionMode,
      subscribedEventTypes: createForm.subscribedEventTypes,
      eventPattern: createForm.eventPattern,
      timeoutSeconds: createForm.timeoutSeconds,
      maxRetries: createForm.maxRetries,
      customHeaders: {},
      autoDisableThreshold: createForm.autoDisableThreshold,
    });
    showCreateDialog.value = false;
    if (store.hmacSecret) {
      showSecretDialog.value = true;
    }
    $q.notify({ type: "positive", message: "Endpoint created" });
    // Reset form
    Object.assign(createForm, {
      name: "",
      url: "",
      description: "",
      subscriptionMode: SubscriptionMode.ALL,
      subscribedEventTypes: [],
      eventPattern: "",
      timeoutSeconds: 30,
      maxRetries: 5,
      autoDisableThreshold: 0,
    });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

function copySecret() {
  if (store.hmacSecret) {
    copyToClipboard(store.hmacSecret);
    $q.notify({ type: "positive", message: "Copied to clipboard" });
  }
}

function viewDelivery(delivery: DeliverySummary) {
  if (!deliveryEndpointId.value) return;
  store.fetchDeliveryDetail(deliveryEndpointId.value, delivery.deliveryId);
  showDeliveryDetail.value = true;
}

async function handleRedeliver(delivery: DeliverySummary) {
  if (!deliveryEndpointId.value) return;
  try {
    await store.redeliverEvent(deliveryEndpointId.value, delivery.deliveryId);
    $q.notify({ type: "positive", message: "Event redelivered" });
    loadDeliveries();
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  }
}

async function selectEventType(eventType: string) {
  selectedEventType.value = eventType;
  testResult.value = null;
  await store.fetchEventDetail(eventType);
}

async function handleSendTest() {
  if (!selectedEventType.value || !testEndpointId.value) return;
  sendingTest.value = true;
  try {
    const resp = await store.sendTestEvent(
      selectedEventType.value,
      testEndpointId.value,
    );
    testResult.value = resp ?? null;
    $q.notify({ type: "positive", message: "Test event sent" });
  } catch {
    $q.notify({ type: "negative", message: store.error ?? "Failed" });
  } finally {
    sendingTest.value = false;
  }
}

// ── Init ──

onMounted(() => {
  loadEndpoints();
  store.fetchAnalytics();
  loadEventTypes();
});
</script>
