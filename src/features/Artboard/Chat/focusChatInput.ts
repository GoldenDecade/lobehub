import { artboardActions } from '../store';

export const CHAT_INPUT_ID = 'artboard-chat-input';

export const focusChatInput = () => {
  artboardActions.setChatOpen(true);
  // The input only exists after the side panel or narrow sheet has mounted.
  setTimeout(() => document.getElementById(CHAT_INPUT_ID)?.focus(), 80);
};
