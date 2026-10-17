import { createContext, useContext, useState } from "react";

const KEY = "bitacora.labels-expanded";

/** Whether a card's label shows as a name or as a bare stripe. The choice is kept in the browser. */
export function useStripeNamesState() {
  const [expanded, setExpanded] = useState(() => localStorage.getItem(KEY) === "true");

  return {
    expanded,
    toggle() {
      localStorage.setItem(KEY, String(!expanded));
      setExpanded(!expanded);
    },
  };
}

export const StripeNamesContext = createContext<ReturnType<typeof useStripeNamesState>>({
  expanded: false,
  toggle() {},
});

export const useStripeNames = () => useContext(StripeNamesContext);
