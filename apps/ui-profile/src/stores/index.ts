import { defineStore } from "#q-app";
import { createPinia } from "pinia";

/** The account pages' Pinia instance, installed before the boot files that read stores. */
export default defineStore(() => createPinia());
