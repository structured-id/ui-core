<template>
  <ceremony-frame>
    <sid-login-form
      :login-fn="login"
      local-login
      register-url="/account/register"
      forgot-password-url="/account/reset"
      @success="onLoginSuccess"
    />
  </ceremony-frame>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { SidLoginForm, useLoginSuccess } from "@structured-id/ui-core/profile";
import CeremonyFrame from "src/components/CeremonyFrame.vue";
import { useAuth } from "src/composables/useAuth";

const { login, prewarm } = useAuth();

// Back to the authorization request the issuer sent the browser here for
// (`rd`, validated against this installation's origin), or into the
// account pages.
const { onLoginSuccess } = useLoginSuccess("/account", {
  issuerOrigin: window.location.origin,
});

// The password client loads while the user types.
onMounted(() => void prewarm());
</script>
