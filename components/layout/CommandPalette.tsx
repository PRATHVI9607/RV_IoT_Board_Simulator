"use client";

import { useEffect, useState, useRef } from "react";
import { useSim } from "@/store/simulatorStore";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";

interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
}

function useCommands(): Command[] {
  const run = useSim((s) => s.run);
  const pause = useSim((s) => s.pause);
  const stop = useSim((s) => s.stop);
  const reset = useSim((s) => s.reset);
  const stepInto = useSim((s) => s.stepInto);
  const stepOver = useSim((s) => s.stepOver);
  const stepOut = useSim((s) => s.stepOut);
  const setSpeed = useSim((s) => s.setSpeed);

  return [
    { id: "run",      label: "Run Simulation",     shortcut: "F5",        action: run },
    { id: "pause",    label: "Pause Simulation",   shortcut: "F5",        action: pause },
    { id: "stop",     label: "Stop Simulation",    shortcut: "Ctrl+F5",   action: stop },
    { id: "reset",    label: "Reset & Reload",     shortcut: "Ctrl+R",    action: reset },
    { id: "stepinto", label: "Step Into",          shortcut: "F11",       action: stepInto },
    { id: "stepover", label: "Step Over",          shortcut: "F10",       action: stepOver },
    { id: "stepout",  label: "Step Out",           shortcut: "Shift+F11", action: stepOut },
    { id: "speed025", label: "Set Speed 0.25×",    description: "Very slow", action: () => setSpeed(0.25) },
    { id: "speed1",   label: "Set Speed 1×",       description: "Normal",   action: () => setSpeed(1) },
    { id: "speed10",  label: "Set Speed 10×",      description: "Fast",     action: () => setSpeed(10) },
    { id: "speedmax", label: "Set Speed MAX",       description: "Full CPU", action: () => setSpeed("max") },
  ];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useCommands();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const filtered = query
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  function run(cmd: Command) {
    cmd.action();
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" />
          <motion.div
            className="relative z-10 w-[480px] rounded-xl border border-line-strong bg-panel shadow-2xl"
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Search bar */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <MagnifyingGlass size={16} className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type a command..."
                className="flex-1 bg-transparent font-mono text-sm text-fg outline-none placeholder:text-muted/50"
                aria-label="Command search"
              />
              <button onClick={() => setOpen(false)} className="text-muted hover:text-fg">
                <X size={14} />
              </button>
            </div>
            {/* Results */}
            <ul className="max-h-72 overflow-auto py-1">
              {filtered.map(cmd => (
                <li key={cmd.id}>
                  <button
                    onClick={() => run(cmd)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-pane"
                  >
                    <div>
                      <span className="text-sm text-fg">{cmd.label}</span>
                      {cmd.description && (
                        <span className="ml-2 text-[10px] text-muted">{cmd.description}</span>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-muted">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted/60">No commands match.</li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
