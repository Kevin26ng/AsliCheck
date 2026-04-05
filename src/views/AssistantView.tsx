import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { chat } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type?: 'analysis' | 'text';
  data?: any;
}

export default function AssistantView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your AsliCheck Assistant, powered by AI. Ask me to fact-check any claim, headline, or news story. I can also explain media literacy concepts and help you evaluate sources.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentInput = input;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await chat(currentInput, history);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: response.analysis ? 'analysis' : 'text',
        data: response.analysis || undefined,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t process your request. Please make sure the API server is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-5xl mx-auto border-x border-[#2f3336]">
      <header className="px-8 py-6 flex items-center justify-between bg-black/50 backdrop-blur-sm sticky top-0 z-30 border-b border-[#2f3336]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#e7e9ea]">AsliCheck Assistant</h1>
          <p className="text-sm text-[#71767b] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#e7e9ea] animate-pulse"></span>
            AI Fact-Checker � Active
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8 space-y-8 scroll-smooth">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex flex-col space-y-2",
              msg.role === 'user' ? "items-end" : "items-start"
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-[#16181c] border border-[#2f3336] flex items-center justify-center text-[#e7e9ea] text-[10px] font-bold">
                  V
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#71767b]">
                  {msg.type === 'analysis' ? 'Analysis Complete' : 'Assistant'}
                </span>
              </div>
            )}

            <div className={cn(
              "px-6 py-4 rounded-3xl max-w-[80%] shadow-sm",
              msg.role === 'user'
                ? "bg-[#e7e9ea] text-black rounded-tr-sm"
                : "bg-[#16181c] text-[#e7e9ea] rounded-tl-sm border border-[#2f3336]"
            )}>
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>

              {msg.type === 'analysis' && msg.data && (
                <div className="mt-4 bg-black p-4 rounded-xl border-l-4 border-[#71767b] shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-[#71767b] tracking-tight">
                    Trust Tag: {msg.data.tag}
                  </span>
                  <p className="text-sm text-[#71767b] leading-relaxed mt-2">
                    {msg.data.details}
                  </p>
                </div>
              )}
            </div>
            <span className="text-[10px] text-[#71767b] px-2 uppercase tracking-tighter">
              {msg.role === 'user' ? 'Sent' : 'Assistant'} � {msg.timestamp}
            </span>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col space-y-2 items-start"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-[#16181c] border border-[#2f3336] flex items-center justify-center text-[#e7e9ea] text-[10px] font-bold">
                V
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#71767b]">
                Analyzing...
              </span>
            </div>
            <div className="px-6 py-4 rounded-3xl rounded-tl-sm bg-[#16181c] border border-[#2f3336]">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#71767b] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#71767b] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#71767b] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <footer className="p-6 space-y-4 bg-black/50 backdrop-blur-md border-t border-[#2f3336]">
        <div className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto mb-2">
          <button className="bg-[#16181c] border border-[#2f3336] text-[#71767b] px-4 py-2 rounded-full text-xs font-bold hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors">
            Verify a Link
          </button>
          <button className="bg-[#16181c] border border-[#2f3336] text-[#71767b] px-4 py-2 rounded-full text-xs font-bold hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors">
            Explain Trust Tags
          </button>
          <button className="bg-[#16181c] border border-[#2f3336] text-[#71767b] px-4 py-2 rounded-full text-xs font-bold hover:text-[#e7e9ea] hover:bg-[#1d1f23] transition-colors">
            Today's Top Fact-Checks
          </button>
        </div>

        <div className="max-w-4xl mx-auto relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isTyping}
            placeholder="Ask about a news claim, headline, or source..."
            className="w-full bg-[#16181c] border border-[#2f3336] shadow-sm rounded-2xl py-5 pl-6 pr-16 focus:ring-1 focus:ring-[#e7e9ea]/20 focus:border-[#e7e9ea]/30 text-lg placeholder:text-[#71767b] text-[#e7e9ea] outline-none transition-all disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#e7e9ea] text-black w-12 h-12 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md font-bold text-lg"
          >
            ?
          </button>
        </div>
        <p className="text-[10px] text-center text-[#71767b] uppercase tracking-widest pt-2 font-bold">
          Powered by AsliCheck AI
        </p>
      </footer>
    </div>
  );
}
