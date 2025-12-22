import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { WatchMode } from "../src/WatchMode.js";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

const TEST_DIR = "./tests/watch_test";

describe("WatchMode", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("EXTENSIONS", () => {
    test("supports markdown extensions", () => {
      expect(WatchMode.EXTENSIONS).toContain(".md");
      expect(WatchMode.EXTENSIONS).toContain(".mdx");
    });

    test("supports HTML extension", () => {
      expect(WatchMode.EXTENSIONS).toContain(".html");
    });
  });

  describe("constructor", () => {
    test("sets input directory", () => {
      const watcher = new WatchMode(TEST_DIR);
      expect(watcher.inputDir).toBe(TEST_DIR);
    });

    test("accepts processor option", () => {
      const mockProcessor = { process: () => {} };
      const watcher = new WatchMode(TEST_DIR, { processor: mockProcessor });
      expect(watcher.processor).toBe(mockProcessor);
    });

    test("accepts output directory option", () => {
      const watcher = new WatchMode(TEST_DIR, { outputDir: "./build" });
      expect(watcher.outputDir).toBe("./build");
    });

    test("uses default debounce of 500ms", () => {
      const watcher = new WatchMode(TEST_DIR);
      expect(watcher.debounceMs).toBe(500);
    });

    test("accepts custom debounce", () => {
      const watcher = new WatchMode(TEST_DIR, { debounceMs: 1000 });
      expect(watcher.debounceMs).toBe(1000);
    });

    test("enables JSONL events by default", () => {
      const watcher = new WatchMode(TEST_DIR);
      expect(watcher.emitJsonl).toBe(true);
    });

    test("can disable JSONL events", () => {
      const watcher = new WatchMode(TEST_DIR, { emitJsonl: false });
      expect(watcher.emitJsonl).toBe(false);
    });

    test("enables recursive watching by default", () => {
      const watcher = new WatchMode(TEST_DIR);
      expect(watcher.recursive).toBe(true);
    });

    test("can disable recursive watching", () => {
      const watcher = new WatchMode(TEST_DIR, { recursive: false });
      expect(watcher.recursive).toBe(false);
    });

    test("initializes with not running state", () => {
      const watcher = new WatchMode(TEST_DIR);
      expect(watcher.isRunning).toBe(false);
      expect(watcher.rebuildCount).toBe(0);
      expect(watcher.watchers).toHaveLength(0);
    });
  });

  describe("handleFileChange", () => {
    test("ignores null filename", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });
      watcher.handleFileChange("change", null);
      expect(watcher.pendingChanges.size).toBe(0);
    });

    test("ignores unsupported file types", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });
      watcher.handleFileChange("change", "test.txt");
      watcher.handleFileChange("change", "script.js");
      watcher.handleFileChange("change", "style.css");
      expect(watcher.pendingChanges.size).toBe(0);
    });

    test("tracks supported file changes", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });

      // Clear any debounce timer
      if (watcher.debounceTimer) {
        clearTimeout(watcher.debounceTimer);
      }

      watcher.handleFileChange("change", "test.md");

      expect(watcher.pendingChanges.size).toBe(1);
      expect(watcher.pendingChanges.has("test.md")).toBe(true);

      // Clear timer to prevent issues
      if (watcher.debounceTimer) {
        clearTimeout(watcher.debounceTimer);
        watcher.debounceTimer = null;
      }
    });

    test("tracks MDX file changes", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });

      watcher.handleFileChange("change", "component.mdx");

      expect(watcher.pendingChanges.has("component.mdx")).toBe(true);

      if (watcher.debounceTimer) {
        clearTimeout(watcher.debounceTimer);
        watcher.debounceTimer = null;
      }
    });

    test("tracks HTML file changes", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });

      watcher.handleFileChange("change", "page.html");

      expect(watcher.pendingChanges.has("page.html")).toBe(true);

      if (watcher.debounceTimer) {
        clearTimeout(watcher.debounceTimer);
        watcher.debounceTimer = null;
      }
    });

    test("stores event type in pending changes", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });

      watcher.handleFileChange("rename", "new-file.md");

      const change = watcher.pendingChanges.get("new-file.md");
      expect(change.eventType).toBe("rename");

      if (watcher.debounceTimer) {
        clearTimeout(watcher.debounceTimer);
        watcher.debounceTimer = null;
      }
    });

    test("sets debounce timer", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });

      watcher.handleFileChange("change", "debounce.md");

      expect(watcher.debounceTimer).not.toBeNull();

      clearTimeout(watcher.debounceTimer);
      watcher.debounceTimer = null;
    });
  });

  describe("getStatus", () => {
    test("returns current status", () => {
      const watcher = new WatchMode(TEST_DIR, { outputDir: "./out" });

      const status = watcher.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.inputDir).toBe(TEST_DIR);
      expect(status.outputDir).toBe("./out");
      expect(status.rebuildCount).toBe(0);
      expect(status.pendingChanges).toBe(0);
      expect(status.watcherCount).toBe(0);
    });

    test("reflects pending changes", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });

      watcher.pendingChanges.set("a.md", { eventType: "change" });
      watcher.pendingChanges.set("b.md", { eventType: "change" });

      expect(watcher.getStatus().pendingChanges).toBe(2);
    });
  });

  describe("emitEvent", () => {
    test("emits event on EventEmitter", () => {
      const watcher = new WatchMode(TEST_DIR, { emitJsonl: false });
      let receivedEvent = null;

      watcher.on("event", (event) => {
        receivedEvent = event;
      });

      watcher.emitEvent({ type: "test_event", data: "hello" });

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent.type).toBe("test_event");
      expect(receivedEvent.data).toBe("hello");
    });
  });

  describe("stop", () => {
    test("sets isRunning to false", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });
      watcher.isRunning = true;

      await watcher.stop();

      expect(watcher.isRunning).toBe(false);
    });

    test("clears pending changes", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });
      watcher.isRunning = true;
      watcher.pendingChanges.set("test.md", { eventType: "change" });

      await watcher.stop();

      expect(watcher.pendingChanges.size).toBe(0);
    });

    test("clears debounce timer", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });
      watcher.isRunning = true;
      watcher.debounceTimer = setTimeout(() => {}, 10000);

      await watcher.stop();

      expect(watcher.debounceTimer).toBeNull();
    });

    test("does nothing if not running", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });

      await watcher.stop();

      expect(watcher.isRunning).toBe(false);
    });

    test("emits watch_stopped event", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });
      watcher.isRunning = true;
      watcher.rebuildCount = 5;

      let stoppedEvent = null;
      watcher.on("event", (e) => {
        if (e.type === "watch_stopped") stoppedEvent = e;
      });

      await watcher.stop();

      expect(stoppedEvent).not.toBeNull();
      expect(stoppedEvent.rebuild_count).toBe(5);
    });
  });

  describe("processPendingChanges", () => {
    test("does nothing if no pending changes", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });
      let eventEmitted = false;

      watcher.on("event", () => {
        eventEmitted = true;
      });

      await watcher.processPendingChanges();

      expect(eventEmitted).toBe(false);
    });

    test("clears pending changes after processing", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });
      watcher.pendingChanges.set("test.md", {
        eventType: "change",
        timestamp: Date.now()
      });

      await watcher.processPendingChanges();

      expect(watcher.pendingChanges.size).toBe(0);
    });

    test("emits changes_detected event", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });
      watcher.pendingChanges.set("detected.md", {
        eventType: "change",
        timestamp: Date.now()
      });

      let changesEvent = null;
      watcher.on("event", (e) => {
        if (e.type === "changes_detected") changesEvent = e;
      });

      await watcher.processPendingChanges();

      expect(changesEvent).not.toBeNull();
      expect(changesEvent.count).toBe(1);
      expect(changesEvent.changes[0].filename).toBe("detected.md");
    });
  });

  describe("rebuild", () => {
    test("increments rebuild count on success", async () => {
      const mockProcessor = { process: async () => {} };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      await watcher.rebuild([{ filename: "test.md" }]);

      expect(watcher.rebuildCount).toBe(1);
    });

    test("sets lastRebuildTime on success", async () => {
      const mockProcessor = { process: async () => {} };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      await watcher.rebuild([{ filename: "test.md" }]);

      expect(watcher.lastRebuildTime).not.toBeNull();
    });

    test("emits rebuild_started event", async () => {
      const mockProcessor = { process: async () => {} };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      let startEvent = null;
      watcher.on("event", (e) => {
        if (e.type === "rebuild_started") startEvent = e;
      });

      await watcher.rebuild([{ filename: "start.md" }]);

      expect(startEvent).not.toBeNull();
      expect(startEvent.changes).toContain("start.md");
    });

    test("emits rebuild_completed event on success", async () => {
      const mockProcessor = { process: async () => {} };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      let completedEvent = null;
      watcher.on("event", (e) => {
        if (e.type === "rebuild_completed") completedEvent = e;
      });

      await watcher.rebuild([{ filename: "complete.md" }]);

      expect(completedEvent).not.toBeNull();
      expect(completedEvent.rebuild_count).toBe(1);
      expect(completedEvent.duration_ms).toBeDefined();
    });

    test("emits rebuild event with success flag", async () => {
      const mockProcessor = { process: async () => {} };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      let rebuildEmit = null;
      watcher.on("rebuild", (result) => {
        rebuildEmit = result;
      });

      await watcher.rebuild([{ filename: "test.md" }]);

      expect(rebuildEmit).not.toBeNull();
      expect(rebuildEmit.success).toBe(true);
    });

    test("handles processor errors", async () => {
      const mockProcessor = {
        process: async () => {
          throw new Error("Processing failed");
        }
      };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      let failedEvent = null;
      watcher.on("event", (e) => {
        if (e.type === "rebuild_failed") failedEvent = e;
      });

      await watcher.rebuild([{ filename: "error.md" }]);

      expect(failedEvent).not.toBeNull();
      expect(failedEvent.error).toBe("Processing failed");
    });

    test("emits rebuild event with error on failure", async () => {
      const mockProcessor = {
        process: async () => {
          throw new Error("Failed");
        }
      };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      let rebuildEmit = null;
      watcher.on("rebuild", (result) => {
        rebuildEmit = result;
      });

      await watcher.rebuild([{ filename: "test.md" }]);

      expect(rebuildEmit.success).toBe(false);
      expect(rebuildEmit.error).toBeDefined();
    });
  });

  describe("forceRebuild", () => {
    test("emits force_rebuild_requested event", async () => {
      const mockProcessor = { process: async () => {} };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      let forceEvent = null;
      watcher.on("event", (e) => {
        if (e.type === "force_rebuild_requested") forceEvent = e;
      });

      await watcher.forceRebuild();

      expect(forceEvent).not.toBeNull();
    });

    test("triggers rebuild with wildcard change", async () => {
      const mockProcessor = { process: async () => {} };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false
      });

      let rebuildChanges = null;
      watcher.on("event", (e) => {
        if (e.type === "rebuild_started") rebuildChanges = e.changes;
      });

      await watcher.forceRebuild();

      expect(rebuildChanges).toContain("*");
    });
  });

  describe("handleError", () => {
    test("emits watch_error event", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });

      // Must add error handler to prevent unhandled error
      watcher.on("error", () => {});

      let errorEvent = null;
      watcher.on("event", (e) => {
        if (e.type === "watch_error") errorEvent = e;
      });

      watcher.handleError(new Error("Test error"));

      expect(errorEvent).not.toBeNull();
      expect(errorEvent.error).toBe("Test error");
    });

    test("emits error on EventEmitter", () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });

      let emittedError = null;
      watcher.on("error", (err) => {
        emittedError = err;
      });

      const testError = new Error("Test error");
      watcher.handleError(testError);

      expect(emittedError).toBe(testError);
    });
  });

  describe("start", () => {
    test("throws if already running", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true });
      watcher.isRunning = true;

      await expect(watcher.start()).rejects.toThrow("already running");
    });

    test("sets isRunning to true", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });

      try {
        await watcher.start();
        expect(watcher.isRunning).toBe(true);
      } finally {
        await watcher.stop();
      }
    });

    test("emits watch_started event", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });

      let startEvent = null;
      watcher.on("event", (e) => {
        if (e.type === "watch_started") startEvent = e;
      });

      try {
        await watcher.start();
        expect(startEvent).not.toBeNull();
        expect(startEvent.input_dir).toBe(TEST_DIR);
      } finally {
        await watcher.stop();
      }
    });

    test("creates file system watcher", async () => {
      const watcher = new WatchMode(TEST_DIR, { silent: true, emitJsonl: false });

      try {
        await watcher.start();
        expect(watcher.watchers.length).toBeGreaterThan(0);
      } finally {
        await watcher.stop();
      }
    });
  });

  describe("integration", () => {
    test("full lifecycle: start, change, stop", async () => {
      const events = [];
      const mockProcessor = { process: async () => {} };
      const watcher = new WatchMode(TEST_DIR, {
        processor: mockProcessor,
        silent: true,
        emitJsonl: false,
        debounceMs: 10
      });

      watcher.on("event", (e) => events.push(e.type));

      await watcher.start();
      expect(events).toContain("watch_started");

      // Simulate file change
      watcher.handleFileChange("change", "test.md");

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 50));

      await watcher.stop();
      expect(events).toContain("watch_stopped");
    });
  });
});
