import { useEffect, useRef } from 'react';
import { useGetCallerUserProfile } from '../hooks/useQueries';
import HeroSection from './HeroSection';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { useAI } from '../contexts/AIContext';

export default function ChatInterface() {
  const { data: userProfile } = useGetCallerUserProfile();
  const { messages, greetUser } = useAI();
  const hasGreeted = useRef(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (userProfile?.id !== lastUserId.current) {
      lastUserId.current = userProfile?.id || null;
      hasGreeted.current = false;
    }
  }, [userProfile?.id]);

  useEffect(() => {
    if (!hasGreeted.current && messages.length === 0) {
      hasGreeted.current = true;
      setTimeout(() => {
        greetUser();
      }, 500);
    }
  }, [userProfile, greetUser, messages.length]);

  return (
    <>
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <HeroSection />
        ) : (
          <MessageList />
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-border bg-background p-4">
        <InputArea />
      </div>
    </>
  );
}
