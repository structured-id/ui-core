/**
 * Shared Quasar component stubs for vitest + @vue/test-utils.
 * QTable renders scoped slots so body-cell-* templates work in tests.
 */
import { defineComponent, h } from "vue";

export const QTableStub = defineComponent({
  name: "QTable",
  props: [
    "rows",
    "columns",
    "rowKey",
    "flat",
    "bordered",
    "pagination",
    "loading",
    "filter",
    "title",
  ],
  setup(props, { slots }) {
    return () => {
      const rows = (props.rows ?? []) as Record<string, unknown>[];
      if (rows.length === 0 && slots["no-data"]) {
        return h("div", { class: "q-table" }, [slots["no-data"]()]);
      }
      const rowEls = rows.map((row) => {
        const cells = ((props.columns ?? []) as { name: string }[]).map(
          (col) => {
            const slotName = `body-cell-${col.name}`;
            if (slots[slotName]) {
              return slots[slotName]!({
                row,
                value: (row as Record<string, unknown>)[col.name],
              });
            }
            return h(
              "td",
              String((row as Record<string, unknown>)[col.name] ?? ""),
            );
          },
        );
        return h("tr", { class: "q-tr" }, cells);
      });
      return h("div", { class: "q-table" }, [h("tbody", rowEls)]);
    };
  },
});

export const quasarStubs = {
  QPage: { template: "<div><slot /></div>" },
  QTable: QTableStub,
  QInput: {
    template: '<input class="q-input" />',
    props: ["modelValue", "label", "outlined", "dense"],
  },
  QSelect: {
    template: '<select class="q-select" />',
    props: ["modelValue", "options", "label", "outlined", "dense", "clearable"],
  },
  QToggle: {
    template: '<input type="checkbox" class="q-toggle" />',
    props: ["modelValue", "label"],
  },
  QBtn: {
    template: '<button class="q-btn">{{ label }}</button>',
    props: [
      "label",
      "icon",
      "color",
      "flat",
      "noCaps",
      "outline",
      "disable",
      "to",
    ],
  },
  QBanner: {
    template:
      '<div class="q-banner"><slot /><slot name="avatar" /><slot name="action" /></div>',
  },
  QBadge: {
    template: '<span class="q-badge">{{ label }}</span>',
    props: ["color", "label"],
  },
  QDialog: {
    template: '<div class="q-dialog"><slot /></div>',
    props: ["modelValue"],
  },
  QCard: { template: "<div><slot /></div>" },
  QCardSection: { template: "<div><slot /></div>" },
  QCardActions: { template: "<div><slot /></div>" },
  QIcon: { template: "<i />" },
  QTooltip: { template: "<span><slot /></span>" },
  QLinearProgress: { template: '<div class="q-linear-progress" />' },
  QTabs: { template: "<div><slot /></div>", props: ["modelValue"] },
  QTab: {
    template: '<div class="q-tab">{{ label }}</div>',
    props: ["name", "label", "icon"],
  },
  QTabPanels: { template: "<div><slot /></div>", props: ["modelValue"] },
  QTabPanel: { template: "<div><slot /></div>", props: ["name"] },
  QCheckbox: {
    template: '<input type="checkbox" class="q-checkbox" />',
    props: ["modelValue", "label"],
  },
  QChip: {
    template: '<span class="q-chip">{{ label }}</span>',
    props: ["label", "color", "icon"],
  },
  QTd: { template: "<td><slot /></td>", props: ["props"] },
  QSeparator: { template: "<hr />" },
  QList: { template: "<div><slot /></div>" },
  QItem: { template: "<div><slot /></div>" },
  QItemSection: { template: "<div><slot /></div>" },
  QItemLabel: { template: "<div><slot /></div>" },
};
