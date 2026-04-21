import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { toast } from "sonner";

interface BlocksCtx {
  blockedIds: Set<string>;
  isBlocked: (id: string | null | undefined) => boolean;
  block: (id: string) => Promise<void>;
  unblock: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BlocksCtx | undefined>(undefined);

export function BlocksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) return setBlockedIds(new Set());
    const { data } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
    setBlockedIds(new Set((data ?? []).map((b) => b.blocked_id)));
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const block = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBlockedIds((prev) => new Set(prev).add(id));
    toast.success("User blocked");
  };

  const unblock = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBlockedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    toast.success("User unblocked");
  };

  return (
    <Ctx.Provider
      value={{
        blockedIds,
        isBlocked: (id) => (id ? blockedIds.has(id) : false),
        block,
        unblock,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useBlocks() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBlocks must be used inside BlocksProvider");
  return v;
}
