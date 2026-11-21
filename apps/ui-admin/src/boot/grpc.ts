import { defineBoot } from "#q-app";
import { setupConsoleTransports } from "#admin/console";

export default defineBoot(() => setupConsoleTransports());
