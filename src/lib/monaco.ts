/**
 * The Monaco version that appears in the asset URL (/monaco/<version>/vs), so the
 * editor's ~24 MB of chunks can be served `immutable` - an upgrade changes every
 * path instead of poisoning caches.
 *
 * scripts/copy-monaco.mjs copies into this directory and fails the build if this
 * constant ever disagrees with the installed monaco-editor, so the two cannot drift.
 */
export const MONACO_VERSION = "0.56.0";
