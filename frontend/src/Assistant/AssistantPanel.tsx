// File: src/Assistant/AssistantPanel.tsx
// 420px right-side slide-in panel per handoff/README.md §10. Read-only: the
// assistant can only answer questions and propose navigation, never mutate
// data -- there is no code path here that calls a write endpoint.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Mic, Send, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { streamAssistantChat, getAssistantHealth, transcribeAudio } from '../api/apiClient';
import type { AssistantChatMessage, AssistantHealth, AssistantNavigateAction } from '../types';
import { useAssistant } from './AssistantContext';
import { useMonth } from '../components/MonthContext';

interface ThreadMessage extends AssistantChatMessage {
  id: number;
  navigateAction?: AssistantNavigateAction;
  isError?: boolean;
}

const SUGGESTIONS = [
  'How much did I spend this month?',
  "What's my top spending category?",
  'Am I over budget anywhere?',
  'How do I add a transaction?',
];

const MAX_RECORDING_MS = 60_000;

let nextId = 1;

/**
 * The assistant's system prompt explicitly instructs it to **bold** every
 * figure and name (see prompts.py's STYLE section) -- render just that one
 * piece of markdown rather than pulling in a full markdown parser for a
 * narrow chat bubble. Anything else (numbered lists, line breaks) already
 * reads fine as plain text with `whitespace-pre-wrap`.
 */
function renderInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-heading font-bold">{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

const AssistantPanel: React.FC = () => {
  const { isOpen, close } = useAssistant();
  const { month, openPicker } = useMonth();
  const navigate = useNavigate();

  const [health, setHealth] = useState<AssistantHealth | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'thinking' | 'fallback' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen && !health) {
      getAssistantHealth().then(setHealth).catch(() => setHealth({ chat: false, voice: false }));
    }
  }, [isOpen, health]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Cancel any in-flight stream and any live recording if the panel closes mid-turn.
    if (!isOpen) {
      abortRef.current?.abort();
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setInput('');
    const userMsg: ThreadMessage = { id: nextId++, role: 'user', content: trimmed };
    const assistantMsg: ThreadMessage = { id: nextId++, role: 'assistant', content: '' };
    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setIsSending(true);
    setStatus(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const event of streamAssistantChat(
        history.map(({ role, content }) => ({ role, content })),
        month,
        controller.signal,
      )) {
        if (event.type === 'status') {
          setStatus(event.state);
        } else if (event.type === 'delta') {
          setStatus(null);
          setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + event.text } : m)));
        } else if (event.type === 'navigate') {
          setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, navigateAction: event } : m)));
        } else if (event.type === 'error') {
          setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: event.message, isError: true } : m)));
        } else if (event.type === 'done') {
          setStatus(null);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: err?.message || 'Something went wrong.', isError: true } : m)));
      }
    } finally {
      setIsSending(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const handleNavigate = (action: AssistantNavigateAction) => {
    // "budget-edit" is allow-listed server-side but has no client-side hookup
    // yet (Budgets' setup modal is page-local state, not reachable from here
    // without prop-drilling) -- the route navigation still happens, it just
    // won't auto-open that modal. month-picker and add-transaction do work.
    navigate(action.route, { state: action.open === 'add-transaction' ? { openAddTransaction: true } : undefined });
    close();
    if (action.open === 'month-picker') {
      // Let the route change settle before layering the picker on top.
      setTimeout(openPicker, 50);
    }
  };

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (!health?.voice || isRecording || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) {
          setIsTranscribing(true);
          try {
            const text = await transcribeAudio(blob);
            setInput((prev) => (prev ? `${prev} ${text}` : text));
          } catch (err: any) {
            toast.error(err?.response?.data?.detail?.message || 'Could not transcribe that — you can still type.');
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      recorder.start();
      setIsRecording(true);
      recordingTimeoutRef.current = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      toast.error('Microphone access was denied.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop, click to close -- doesn't scrim as darkly as a modal since it's a side panel, not blocking the whole app. */}
      <div className="fixed inset-0 z-40" style={{ background: 'var(--scrim)' }} onClick={close} />
      <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-[420px] bg-bg border-l-2 border-line flex flex-col animate-[assistant-slide-in_220ms_ease-out]">
        <style>{`@keyframes assistant-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div className="p-5 border-b-2 border-line flex items-start gap-3">
          <div className="w-10 h-10 rounded-[14px] border-2 border-candyLine bg-candy-lilac shadow-chip flex items-center justify-center text-[#1E1B16] shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-extrabold text-base">Ask about your spending</p>
            <p className="font-body text-xs text-muted mt-0.5">Read-only · never changes your data</p>
          </div>
          <button onClick={close} aria-label="Close assistant" className="w-8 h-8 rounded-chip border border-line flex items-center justify-center hover:bg-hair transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {health && !health.chat && (
            <p className="font-body text-sm text-center text-muted p-4 rounded-card border border-dashed border-faint">
              The assistant is unavailable right now. Please try again shortly.
            </p>
          )}

          {messages.length === 0 && health?.chat && (
            <p className="font-body text-sm text-muted text-center py-6">
              Ask me anything about your spending, or where to find something in the app.
            </p>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%]">
                <div
                  className={[
                    'px-4 py-2.5 font-body text-sm whitespace-pre-wrap break-words',
                    m.role === 'user'
                      ? 'bg-candy-blue text-[#1E1B16] rounded-2xl rounded-br-[5px]'
                      : m.isError
                      ? 'bg-candy-coral/20 border border-candyLine rounded-2xl rounded-bl-[5px]'
                      : 'bg-card border border-line rounded-2xl rounded-bl-[5px]',
                  ].join(' ')}
                >
                  {m.content ? renderInlineBold(m.content) : (m.role === 'assistant' && isSending ? '…' : '')}
                </div>
                {m.navigateAction && (
                  <button
                    onClick={() => handleNavigate(m.navigateAction!)}
                    className="mt-2 flex items-center gap-1.5 px-3.5 py-2 rounded-chip border-1.5 border-candyLine bg-candy-yellow font-body font-semibold text-xs shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
                  >
                    → {m.navigateAction.label}
                  </button>
                )}
              </div>
            </div>
          ))}

          {status && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-[5px] bg-card border border-line font-body text-xs text-muted italic">
                {status === 'thinking' ? 'Thinking…' : 'Taking a bit longer than usual…'}
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {messages.length === 0 && health?.chat && (
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="px-3 py-1.5 rounded-full border border-line font-body text-xs hover:bg-hair transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 border-t-2 border-line flex items-center gap-2">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!health?.voice || isTranscribing}
            title={health?.voice ? (isRecording ? 'Stop recording' : 'Record a question') : health?.voice_reason || 'Voice unavailable'}
            className={[
              'w-10 h-10 rounded-full border-2 border-candyLine flex items-center justify-center shrink-0 transition-all disabled:opacity-40',
              isRecording ? 'bg-semantic-red text-white animate-pulse' : 'bg-candy-coral text-[#1E1B16]',
            ].join(' ')}
          >
            {isRecording ? <Square size={15} /> : <Mic size={16} />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={isTranscribing ? 'Transcribing…' : 'Ask a question…'}
            disabled={!health?.chat || isSending}
            className="flex-1 min-w-0 bg-card border border-line rounded-full px-4 py-2.5 font-body text-sm outline-none focus:border-candyLine disabled:opacity-60"
          />
          <button
            onClick={() => send(input)}
            disabled={!health?.chat || isSending || !input.trim()}
            aria-label="Send"
            className="w-10 h-10 rounded-full border-2 border-candyLine bg-candy-blue text-[#1E1B16] flex items-center justify-center shrink-0 disabled:opacity-40 hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-press"
          >
            <Send size={15} />
          </button>
        </div>
      </aside>
    </>
  );
};

export default AssistantPanel;
