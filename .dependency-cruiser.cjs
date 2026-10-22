/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "G1: no circular dependencies.",
      from: {},
      to: { circular: true },
    },
    {
      name: "shared-imports-nothing-app-side",
      severity: "error",
      comment: "G2: src/shared must not import server, lib, components or app.",
      from: { path: "^src/shared" },
      to: { path: "^src/(server|lib|components|app)" },
    },
    {
      name: "legacy-and-ui-not-into-server",
      severity: "error",
      comment:
        "G3: lib and components reach src/server only for types, except the old back end (strangler exemption).",
      from: {
        path: "^src/(lib|components)",
        pathNot: "^src/lib/(services|domain|data|sse|api|auth)/",
      },
      to: { path: "^src/server", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "platform-imports-no-feature-module",
      severity: "error",
      comment: "G4: platform must not import a feature module.",
      from: { path: "^src/server/platform" },
      to: { path: "^src/server/(?!platform)" },
    },
    {
      name: "notification-achievements-only-via-runtime",
      severity: "error",
      comment: "G5: only src/server/runtime.ts wires notification and achievements.",
      from: {
        path: "^src/server/",
        pathNot: [
          "^src/server/runtime\\.ts$",
          "^src/server/(notification|achievements)/",
        ],
      },
      to: { path: "^src/server/(notification|achievements)" },
    },
    {
      name: "runtime-only-from-app",
      severity: "error",
      comment: "G6: only src/app may import src/server/runtime.ts.",
      from: { pathNot: "^src/app" },
      to: { path: "^src/server/runtime\\.ts$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
