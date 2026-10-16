import { createContext, useContext, useState } from "react";

const KEY = "bitacora.labels-expanded";

export function useLabelsState() {
  const [expanded, setExpanded] = useState(() => localStorage.getItem(KEY) === "true");

  return {
    expanded,
    toggle() {
      localStorage.setItem(KEY, String(!expanded));
      setExpanded(!expanded);
    },
  };
}

export const LabelsContext = createContext<ReturnType<typeof useLabelsState>>({
  expanded: false,
  toggle() {},
});

export const useLabels = () => useContext(LabelsContext);
