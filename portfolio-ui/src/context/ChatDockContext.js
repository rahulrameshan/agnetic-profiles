/*
 * ChatDockContext.js
 * ------------------
 * Which conversation the floating dock is showing, if any.
 *
 * Lives in context rather than in the dock itself so anything on the page — a
 * notification row, a profile link — can open a thread without navigating away.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ChatDockContext = createContext(null);

export function ChatDockProvider({ children }) {
  const [openId, setOpenId] = useState(null);
  const [listOpen, setListOpen] = useState(false);

  const openConversation = useCallback((conversationId) => {
    setOpenId(conversationId);
    setListOpen(true);
  }, []);

  const openList = useCallback(() => {
    setOpenId(null);
    setListOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpenId(null);
    setListOpen(false);
  }, []);

  const value = useMemo(
    () => ({ openId, listOpen, openConversation, openList, close }),
    [openId, listOpen, openConversation, openList, close]
  );

  return (
    <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>
  );
}

export function useChatDock() {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error("useChatDock must be used inside a ChatDockProvider");
  return ctx;
}
