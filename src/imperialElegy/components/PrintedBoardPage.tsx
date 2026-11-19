/**
 * The printable board route.  It intentionally sits outside the match shell:
 * no game state, no websocket, no seat — just the sheet.
 */
import React from "react";
import PrintedBoard from "./PrintedBoard";
import {ieLocale} from "./i18n";
import "./imperial-elegy.css";

export const PrintedBoardPage = () => {
  // The global app bar is useful in the match shell and wrong on a full-bleed
  // sheet; the body class lets the stylesheet hide it without reaching across
  // the router.
  React.useEffect(() => {
    document.body.classList.add("ie-printed-route");
    return () => document.body.classList.remove("ie-printed-route");
  }, []);
  // The toolbar follows the UI language; the sheet's own printed art does not.
  return <PrintedBoard locale={ieLocale()}/>;
};

export default PrintedBoardPage;
