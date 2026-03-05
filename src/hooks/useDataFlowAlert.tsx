import { useEffect, useState } from "react";
import { fetchDataflowAlert, DataflowAlert } from "@/lib/api";

/**
 * Polls Supabase (via fetchDataflowAlert) every 60 s to detect data-flow issues.
 * Replaces the old Express /api/alerts/dataflow endpoint.
 */
export function useDataFlowAlert(intervalMs = 60_000) {
  const [alert, setAlert] = useState<DataflowAlert | null>(null);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    try {
      const result = await fetchDataflowAlert();
      setAlert(result);
    } catch (err) {
      console.error("useDataFlowAlert:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { alert, loading };
}
