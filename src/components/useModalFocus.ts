import { RefObject, useEffect } from 'react';
/** Keep keyboard focus in the active sheet and restore its trigger on dismissal. */
export function useModalFocus(open: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const elements = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]') || []).filter(el=>el.getClientRects().length>0);
    elements()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if(e.key !== 'Tab' || document.querySelector('dialog[open]')) return;
      const list=elements(), first=list[0],last=list.at(-1);
      if(!first) return;
      if(e.shiftKey && (document.activeElement===first || !ref.current?.contains(document.activeElement))) {e.preventDefault();last?.focus();}
      else if(!e.shiftKey && (document.activeElement===last || !ref.current?.contains(document.activeElement))) {e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',trap);
    return()=>{document.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus();};
  },[open,ref]);
}
