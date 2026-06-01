"use client";

import { useRef, useState, useEffect } from "react";
import { useSim, getEngine } from "@/store/simulatorStore";
import { PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { PaperPlaneRight, Trash } from "@phosphor-icons/react";

export function SerialMonitor() {
  const serial = useSim((s) => s.serial);
  const sendSerial = useSim((s) => s.sendSerial);
  const clearSerial = useSim((s) => s.clearSerial);
  // Re-read baud each render (cheap; UART baud rarely changes).
  const baud = getEngine().uart0.baud;
  const [input, setInput] = useState("");
  const termRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [serial]);

  function send() {
    if (!input) return;
    sendSerial(input + "\r\n");
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Serial Monitor · UART0"
        right={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">{baud || 9600} baud</span>
            <Button variant="ghost" onClick={clearSerial} aria-label="Clear serial output">
              <Trash size={12} />
            </Button>
          </div>
        }
      />
      <pre
        ref={termRef}
        className="terminal-output min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px] leading-relaxed text-signal"
      >
        {serial || (
          <span className="text-muted/50">
            UART0 output will appear here. Type below to send data to the CPU.
          </span>
        )}
      </pre>
      <div className="flex items-center gap-2 border-t border-line p-2">
        <input
          className="flex-1 rounded border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg outline-none focus:border-accent-line"
          placeholder="Type to send to UART0 RX..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Button variant="accent" onClick={send} aria-label="Send">
          <PaperPlaneRight size={14} weight="fill" />
        </Button>
      </div>
    </div>
  );
}
