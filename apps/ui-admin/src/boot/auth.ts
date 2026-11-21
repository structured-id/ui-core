import { defineBoot } from "#q-app";
import { guardConsole } from "#admin/console";

export default defineBoot(({ router }) => guardConsole(router));
